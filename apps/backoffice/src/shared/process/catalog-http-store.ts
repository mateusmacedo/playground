import type { ApiError } from '@/shared/api/api-result';
import type { ProcessDefinitionDocument } from '@/shared/api/contract';
import type { ProcessDefinitionsApi } from '@/shared/api/process-definitions-api';

import type { ProcessCatalog, ProcessDefinition } from './catalog';
import type {
  CatalogFailed,
  CatalogLoadResult,
  CatalogSaveResult,
  CatalogStore,
  CatalogWritten,
} from './catalog-store';
import {
  contentText,
  type DefinitionContent,
  definitionContent,
  readDefinition,
} from './definition-documents';

/** O que o servidor tem de um processo, pela última leitura ou gravação deste adaptador. */
interface Synced {
  readonly revision: number;
  /** Texto do conteúdo gravado, para saber se o processo mudou desde então. */
  readonly text: string;
}

interface WriteParams {
  readonly definition: ProcessDefinition;
  readonly content: DefinitionContent;
  readonly text: string;
  /** Grava por cima do que outro lugar gravou. */
  readonly overwrite: boolean;
}

interface ReplaceParams extends WriteParams {
  /** Revisão que esta tela leu. */
  readonly revision: number;
}

interface SettleParams extends WriteParams {
  /** O processo como o servidor tem agora. */
  readonly server: ProcessDefinitionDocument;
}

interface SendParams {
  readonly catalog: ProcessCatalog;
  readonly overwrite: boolean;
}

const WRITTEN: CatalogWritten = { ok: true };

const CRASHED: CatalogFailed = {
  ok: false,
  failure: {
    kind: 'unavailable',
    message: 'Não foi possível concluir a operação. Tente de novo.',
  },
};

function unavailable(error: ApiError): CatalogFailed {
  return {
    ok: false,
    failure: { kind: 'unavailable', message: error.message },
  };
}

function conflict(definition: ProcessDefinition): CatalogFailed {
  return {
    ok: false,
    failure: {
      kind: 'conflict',
      message: `O processo ${definition.name} foi alterado em outro lugar depois que você o abriu.`,
      definitionId: definition.id,
    },
  };
}

/** O conteúdo que o servidor tem, como esta tela o lê; `null` quando ela não consegue ler. */
function serverText(document: ProcessDefinitionDocument): string | null {
  const definition = readDefinition(document);
  return definition === null
    ? null
    : contentText(definitionContent(definition));
}

/**
 * Catálogo de processos guardado na API do painel, um documento por processo. A leitura traz todos; a gravação compara
 * o catálogo com o que o servidor tem e envia só o que mudou, um processo por vez: o novo é criado e o alterado é
 * regravado com a revisão lida, que o servidor confere. Leituras e gravações entram na mesma fila, na ordem pedida.
 */
export function createHttpCatalogStore(
  api: ProcessDefinitionsApi,
): CatalogStore {
  const synced = new Map<string, Synced>();
  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T extends CatalogLoadResult | CatalogSaveResult>(
    task: () => Promise<T>,
  ): Promise<T | CatalogFailed> {
    // WHY: uma exceção inesperada num passo viraria rejeição da fila, e toda operação seguinte ficaria presa nela.
    const run = queue.then(task).catch((): CatalogFailed => CRASHED);
    queue = run;
    return run;
  }

  function remember(params: Synced & { readonly id: string }): CatalogWritten {
    synced.set(params.id, { revision: params.revision, text: params.text });
    return WRITTEN;
  }

  /** O servidor tem o processo numa revisão que esta tela não leu: confere se é a mesma coisa ou grava por cima. */
  async function settle(params: SettleParams): Promise<CatalogSaveResult> {
    const { definition, content, text, server, overwrite } = params;
    const { id } = content;
    if (serverText(server) === text) {
      // WHY: é a gravação anterior desta tela, que chegou ao servidor e ficou sem resposta (rede caiu, tempo esgotou).
      // Repetir o pedido não pode virar conflito nem gravação em dobro.
      return remember({ id, revision: server.revision, text });
    }
    if (!overwrite) {
      return conflict(definition);
    }
    const forced = await api.update({ ...content, revision: server.revision });
    if (forced.ok) {
      return remember({ id, revision: forced.value.revision, text });
    }
    return forced.error.kind === 'conflict'
      ? conflict(definition)
      : unavailable(forced.error);
  }

  async function create(params: WriteParams): Promise<CatalogSaveResult> {
    const { content, text } = params;
    const created = await api.create(content);
    if (created.ok) {
      return remember({
        id: content.id,
        revision: created.value.revision,
        text,
      });
    }
    if (created.error.kind !== 'invalid') {
      return unavailable(created.error);
    }
    // WHY: o servidor recusa criar um id que já existe, e o contrato não tem resposta própria para isso. Só lendo o
    // processo dá para saber se a recusa é essa ou se o conteúdo é que é inválido.
    const current = await api.get(content.id);
    if (current.ok) {
      return settle({ ...params, server: current.value });
    }
    return unavailable(
      current.error.kind === 'not-found' ? created.error : current.error,
    );
  }

  async function replace(params: ReplaceParams): Promise<CatalogSaveResult> {
    const { definition, content, text, revision, overwrite } = params;
    const { id } = content;
    const updated = await api.update({ ...content, revision });
    if (updated.ok) {
      return remember({ id, revision: updated.value.revision, text });
    }
    const { kind } = updated.error;
    if (kind !== 'conflict' && kind !== 'not-found') {
      return unavailable(updated.error);
    }
    const current = await api.get(id);
    if (current.ok) {
      return settle({ ...params, server: current.value });
    }
    if (current.error.kind !== 'not-found') {
      return unavailable(current.error);
    }
    // NOTE: o processo saiu do servidor (os dados foram reiniciados, por exemplo). Para esta tela é um conflito como
    // outro; manter a versão dela é criar o processo de novo.
    synced.delete(id);
    if (!overwrite) {
      return conflict(definition);
    }
    const created = await api.create(content);
    return created.ok
      ? remember({ id, revision: created.value.revision, text })
      : unavailable(created.error);
  }

  async function send(params: SendParams): Promise<CatalogSaveResult> {
    const { catalog, overwrite } = params;
    for (const definition of catalog.definitions) {
      const content = definitionContent(definition);
      const text = contentText(content);
      const known = synced.get(definition.id);
      if (known?.text === text) {
        continue;
      }
      const write: WriteParams = { definition, content, text, overwrite };
      const result =
        known === undefined
          ? await create(write)
          : await replace({ ...write, revision: known.revision });
      if (!result.ok) {
        return result;
      }
    }
    return WRITTEN;
  }

  async function read(): Promise<CatalogLoadResult> {
    const listed = await api.list();
    if (!listed.ok) {
      return unavailable(listed.error);
    }
    synced.clear();
    const definitions: ProcessDefinition[] = [];
    for (const document of listed.value) {
      const definition = readDefinition(document);
      // NOTE: de id repetido fica o primeiro, como na leitura do catálogo gravado no navegador.
      if (definition === null || synced.has(definition.id)) {
        continue;
      }
      definitions.push(definition);
      synced.set(definition.id, {
        revision: document.revision,
        text: contentText(definitionContent(definition)),
      });
    }
    return { ok: true, catalog: { definitions } };
  }

  return {
    load: () => enqueue(read),
    save: (catalog) => enqueue(() => send({ catalog, overwrite: false })),
    overwrite: (catalog) => enqueue(() => send({ catalog, overwrite: true })),
    // NOTE: o servidor não avisa o que outro lugar gravou; a tela relê o catálogo quando a pessoa volta para a aba.
    subscribe: () => () => undefined,
  };
}

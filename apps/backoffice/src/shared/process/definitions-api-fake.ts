import {
  type ApiErrorKind,
  type ApiFailure,
  type ApiResult,
  failed,
  succeeded,
} from '@/shared/api/api-result';
import type { ProcessDefinitionDocument } from '@/shared/api/contract';
import type { ProcessDefinitionsApi } from '@/shared/api/process-definitions-api';

import type { ProcessDefinition } from './catalog';
import { definitionContent } from './definition-documents';

export type FakeOperation = 'list' | 'create' | 'get' | 'update';

/** Uma chamada que a API simulada recebeu. */
export interface FakeCall {
  readonly operation: FakeOperation;
  readonly id?: string;
  /** Revisão enviada como a lida, na regravação. */
  readonly revision?: number;
}

export interface FailNextParams {
  readonly operation: FakeOperation;
  readonly kind: ApiErrorKind;
  /** A operação é feita antes de a resposta falhar, como a resposta que se perde no caminho. */
  readonly afterApplying?: boolean;
}

export interface BeforeNextParams {
  readonly operation: FakeOperation;
  /** O que acontece no servidor logo antes de ele atender a chamada. */
  readonly effect: () => void;
}

/**
 * API de definições em memória para os testes, com as regras do servidor: a criação recusa o id que já existe, e a
 * regravação confere a revisão lida e grava a seguinte.
 */
export interface FakeDefinitionsApi extends ProcessDefinitionsApi {
  readonly calls: FakeCall[];
  /** O processo como o servidor o tem; `undefined` quando ele não está lá. */
  readonly stored: (id: string) => ProcessDefinitionDocument | undefined;
  /** Grava o processo como outro cliente faria: cria na revisão 1 ou regrava na revisão seguinte. */
  readonly put: (definition: ProcessDefinition) => void;
  /** Tira o processo do servidor. */
  readonly drop: (id: string) => void;
  /** A próxima chamada da operação falha com o caso de erro. */
  readonly failNext: (params: FailNextParams) => void;
  readonly beforeNext: (params: BeforeNextParams) => void;
}

interface AnswerParams<T> {
  readonly call: FakeCall;
  /** O que o servidor faz e responde quando nada foi combinado para a chamada. */
  readonly apply: () => ApiResult<T>;
}

interface Planned {
  readonly operation: FakeOperation;
  readonly kind?: ApiErrorKind;
  readonly afterApplying?: boolean;
  readonly effect?: () => void;
}

export function fakeDefinitionsApi(
  initial: readonly ProcessDefinition[] = [],
): FakeDefinitionsApi {
  const documents = new Map<string, ProcessDefinitionDocument>();
  const calls: FakeCall[] = [];
  const planned: Planned[] = [];

  function put(definition: ProcessDefinition): void {
    const revision = (documents.get(definition.id)?.revision ?? 0) + 1;
    documents.set(definition.id, {
      ...definitionContent(definition),
      revision,
    });
  }

  /** Tira da lista o que foi combinado para a próxima chamada da operação, na ordem em que foi combinado. */
  function takePlanned(operation: FakeOperation): Planned | undefined {
    const index = planned.findIndex((item) => item.operation === operation);
    return index < 0 ? undefined : planned.splice(index, 1)[0];
  }

  function answer<T>(params: AnswerParams<T>): Promise<ApiResult<T>> {
    const { call, apply } = params;
    calls.push(call);
    const plan = takePlanned(call.operation);
    plan?.effect?.();
    if (plan?.kind === undefined) {
      return Promise.resolve(apply());
    }
    if (plan.afterApplying) {
      apply();
    }
    const failure: ApiFailure = failed({ kind: plan.kind });
    return Promise.resolve(failure);
  }

  for (const definition of initial) {
    put(definition);
  }

  return {
    calls,
    stored: (id) => documents.get(id),
    put,
    drop: (id) => {
      documents.delete(id);
    },
    failNext: (params) => {
      planned.push(params);
    },
    beforeNext: (params) => {
      planned.push(params);
    },
    list: () =>
      answer({
        call: { operation: 'list' },
        apply: () => succeeded([...documents.values()]),
      }),
    get: (id) =>
      answer<ProcessDefinitionDocument>({
        call: { operation: 'get', id },
        apply: () => {
          const document = documents.get(id);
          return document === undefined
            ? failed({ kind: 'not-found', status: 404 })
            : succeeded(document);
        },
      }),
    create: (document) =>
      answer<ProcessDefinitionDocument>({
        call: { operation: 'create', id: document.id },
        apply: () => {
          if (documents.has(document.id)) {
            return failed({ kind: 'invalid', status: 422 });
          }
          const created = { ...document, revision: 1 };
          documents.set(document.id, created);
          return succeeded(created);
        },
      }),
    update: (document) =>
      answer<ProcessDefinitionDocument>({
        call: {
          operation: 'update',
          id: document.id,
          revision: document.revision,
        },
        apply: () => {
          const current = documents.get(document.id);
          if (current === undefined) {
            return failed({ kind: 'not-found', status: 404 });
          }
          if (current.revision !== document.revision) {
            return failed({ kind: 'conflict', status: 412 });
          }
          const updated = { ...document, revision: document.revision + 1 };
          documents.set(document.id, updated);
          return succeeded(updated);
        },
      }),
  };
}

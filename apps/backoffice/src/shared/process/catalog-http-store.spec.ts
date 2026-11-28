import { API_ERROR_MESSAGES } from '@/shared/api/api-result';

import type { ProcessCatalog } from './catalog';
import { createHttpCatalogStore } from './catalog-http-store';
import { testDefinition, testVersion } from './catalog-test-data';
import { definitionContent } from './definition-documents';
import {
  type FakeDefinitionsApi,
  fakeDefinitionsApi,
} from './definitions-api-fake';

const service = testDefinition({ draftText: 'rascunho' });
const billing = testDefinition({ id: 'process-2', name: 'Cobrança' });
const renamed = { ...service, name: 'Atendimento ao cliente' };
/** O processo de atendimento como outro cliente o deixou. */
const elsewhere = { ...service, draftText: 'rascunho de outro lugar' };

const CONFLICT = {
  ok: false,
  failure: {
    kind: 'conflict',
    message:
      'O processo Atendimento ao cliente foi alterado em outro lugar depois que você o abriu.',
    definitionId: 'process-1',
  },
};

function unavailable(message: string) {
  return { ok: false, failure: { kind: 'unavailable', message } };
}

function operations(api: FakeDefinitionsApi): string[] {
  return api.calls.map((call) => `${call.operation} ${call.id ?? ''}`.trim());
}

/** Adaptador sobre a API com os processos dados, já lidos. */
async function loadedStore(api: FakeDefinitionsApi) {
  const store = createHttpCatalogStore(api);
  await store.load();
  api.calls.length = 0;
  return store;
}

describe('createHttpCatalogStore', () => {
  describe('leitura', () => {
    it('lê todos os processos do servidor, na ordem em que vieram', async () => {
      const api = fakeDefinitionsApi([service, billing]);

      const read = await createHttpCatalogStore(api).load();

      expect(read).toEqual({
        ok: true,
        catalog: { definitions: [service, billing] },
      });
    });

    it('devolve o catálogo vazio quando o servidor não tem processo', async () => {
      const read = await createHttpCatalogStore(fakeDefinitionsApi()).load();

      expect(read).toEqual({ ok: true, catalog: { definitions: [] } });
    });

    it('deixa de fora o documento que não forma um processo, sem perder os outros', async () => {
      const api = fakeDefinitionsApi([service]);
      vi.spyOn(api, 'list').mockResolvedValue({
        ok: true,
        value: [
          { id: 'x', revision: 1, schemaVersion: 1, definition: null },
          { ...definitionContent(service), revision: 1 },
          { ...definitionContent(service), revision: 7 },
        ],
      });

      const read = await createHttpCatalogStore(api).load();

      expect(read).toEqual({ ok: true, catalog: { definitions: [service] } });
    });

    it('devolve a falha com a mensagem da API quando o servidor não responde', async () => {
      const api = fakeDefinitionsApi([service]);
      api.failNext({ operation: 'list', kind: 'network' });

      const read = await createHttpCatalogStore(api).load();

      expect(read).toEqual(unavailable(API_ERROR_MESSAGES.network));
    });

    it('não tem aviso do que outro lugar grava', () => {
      const listener = vi.fn();
      const store = createHttpCatalogStore(fakeDefinitionsApi());

      const unsubscribe = store.subscribe(listener);
      unsubscribe();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('gravação', () => {
    it('cria o processo novo e regrava só o que mudou, um por vez', async () => {
      const api = fakeDefinitionsApi([service, billing]);
      const store = await loadedStore(api);
      const created = testDefinition({ id: 'process-3', name: 'Compras' });
      const catalog: ProcessCatalog = {
        definitions: [renamed, billing, created],
      };

      const saved = await store.save(catalog);

      expect(saved).toEqual({ ok: true });
      expect(operations(api)).toEqual(['update process-1', 'create process-3']);
      expect(api.calls[0].revision).toBe(1);
      expect(api.stored('process-1')).toMatchObject({ revision: 2 });
      expect(api.stored('process-3')).toMatchObject({ revision: 1 });
    });

    it('não envia nada quando o catálogo é o que o servidor já tem', async () => {
      const api = fakeDefinitionsApi([service, billing]);
      const store = await loadedStore(api);

      const saved = await store.save({ definitions: [service, billing] });

      expect(saved).toEqual({ ok: true });
      expect(api.calls).toEqual([]);
    });

    it('regrava de novo com a revisão que a gravação anterior devolveu', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      await store.save({ definitions: [renamed] });

      await store.save({
        definitions: [{ ...renamed, versions: [testVersion(1)] }],
      });

      expect(api.calls.map((call) => call.revision)).toEqual([1, 2]);
      expect(api.stored('process-1')).toMatchObject({ revision: 3 });
    });

    it('cria tudo quando grava sem ter lido', async () => {
      const api = fakeDefinitionsApi();

      const saved = await createHttpCatalogStore(api).save({
        definitions: [service, billing],
      });

      expect(saved).toEqual({ ok: true });
      expect(operations(api)).toEqual(['create process-1', 'create process-2']);
    });

    it('faz as gravações na ordem pedida, uma depois da outra', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);

      const first = store.save({ definitions: [renamed] });
      const second = store.save({ definitions: [renamed, billing] });

      expect(await Promise.all([first, second])).toEqual([
        { ok: true },
        { ok: true },
      ]);
      expect(operations(api)).toEqual(['update process-1', 'create process-2']);
    });

    it('para na falha e devolve a mensagem da API', async () => {
      const api = fakeDefinitionsApi([service, billing]);
      const store = await loadedStore(api);
      api.failNext({ operation: 'update', kind: 'server' });

      const saved = await store.save({
        definitions: [renamed, { ...billing, name: 'Faturamento' }],
      });

      expect(saved).toEqual(unavailable(API_ERROR_MESSAGES.server));
      expect(operations(api)).toEqual(['update process-1']);
    });

    it('na tentativa seguinte, envia só o que a falha deixou para trás', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      const catalog: ProcessCatalog = { definitions: [renamed, billing] };
      api.failNext({ operation: 'create', kind: 'network' });
      await store.save(catalog);
      api.calls.length = 0;

      const saved = await store.save(catalog);

      expect(saved).toEqual({ ok: true });
      expect(operations(api)).toEqual(['create process-2']);
    });

    it('vira falha, sem travar as gravações seguintes, quando a API lança', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      vi.spyOn(api, 'update').mockRejectedValueOnce(new Error('inesperado'));

      const crashed = await store.save({ definitions: [renamed] });
      const saved = await store.save({ definitions: [renamed] });

      expect(crashed).toEqual(
        unavailable('Não foi possível concluir a operação. Tente de novo.'),
      );
      expect(saved).toEqual({ ok: true });
    });
  });

  describe('conflito', () => {
    it('não grava o processo que outro lugar alterou depois da leitura', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.put(elsewhere);

      const saved = await store.save({ definitions: [renamed] });

      expect(saved).toEqual(CONFLICT);
      expect(api.stored('process-1')).toMatchObject({
        revision: 2,
        definition: { draftText: 'rascunho de outro lugar' },
      });
    });

    it('continua em conflito enquanto a tela não recarrega nem escolhe manter', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.put(elsewhere);
      await store.save({ definitions: [renamed] });

      const saved = await store.save({ definitions: [renamed] });

      expect(saved).toEqual(CONFLICT);
    });

    it('grava por cima com a revisão que o servidor tem agora', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.put(elsewhere);
      api.calls.length = 0;

      const saved = await store.overwrite({ definitions: [renamed] });

      expect(saved).toEqual({ ok: true });
      expect(api.calls.map((call) => call.revision)).toEqual([1, undefined, 2]);
      expect(api.stored('process-1')).toMatchObject({
        revision: 3,
        definition: { name: 'Atendimento ao cliente', draftText: 'rascunho' },
      });
    });

    it('volta a gravar normalmente depois de gravar por cima', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.put(elsewhere);
      await store.overwrite({ definitions: [renamed] });

      const saved = await store.save({
        definitions: [{ ...renamed, description: 'Fila única' }],
      });

      expect(saved).toEqual({ ok: true });
      expect(api.stored('process-1')).toMatchObject({ revision: 4 });
    });

    it('segue em conflito quando outro lugar grava de novo no meio do gravar por cima', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.put(elsewhere);
      api.beforeNext({
        operation: 'get',
        effect: () =>
          api.beforeNext({
            operation: 'update',
            effect: () => api.put({ ...elsewhere, name: 'Fila' }),
          }),
      });

      const saved = await store.overwrite({ definitions: [renamed] });

      expect(saved).toEqual(CONFLICT);
    });

    it('devolve a falha quando o gravar por cima não chega ao servidor', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.put(elsewhere);
      api.beforeNext({
        operation: 'get',
        effect: () => api.failNext({ operation: 'update', kind: 'timeout' }),
      });

      const saved = await store.overwrite({ definitions: [renamed] });

      expect(saved).toEqual(unavailable(API_ERROR_MESSAGES.timeout));
    });

    it('trata como conflito o que o servidor tem e esta tela não consegue ler', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.put(elsewhere);
      vi.spyOn(api, 'get').mockResolvedValueOnce({
        ok: true,
        value: {
          id: 'process-1',
          revision: 2,
          schemaVersion: 99,
          definition: {},
        },
      });

      const saved = await store.save({ definitions: [renamed] });

      expect(saved).toEqual(CONFLICT);
    });

    it('devolve a falha quando não consegue ler o que o servidor tem', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.put(elsewhere);
      api.failNext({ operation: 'get', kind: 'network' });

      const saved = await store.save({ definitions: [renamed] });

      expect(saved).toEqual(unavailable(API_ERROR_MESSAGES.network));
    });

    it('trata como conflito o processo que saiu do servidor', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.drop('process-1');

      const saved = await store.save({ definitions: [renamed] });

      expect(saved).toEqual(CONFLICT);
      expect(api.stored('process-1')).toBeUndefined();
    });

    it('cria de novo, ao gravar por cima, o processo que saiu do servidor', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.drop('process-1');

      const saved = await store.overwrite({ definitions: [renamed] });

      expect(saved).toEqual({ ok: true });
      expect(api.stored('process-1')).toMatchObject({
        revision: 1,
        definition: { name: 'Atendimento ao cliente' },
      });
    });

    it('devolve a falha quando não consegue criar de novo o processo que saiu do servidor', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.drop('process-1');
      api.failNext({ operation: 'create', kind: 'server' });

      const saved = await store.overwrite({ definitions: [renamed] });

      expect(saved).toEqual(unavailable(API_ERROR_MESSAGES.server));
    });
  });

  describe('pedido repetido', () => {
    it('reconhece a regravação que chegou ao servidor e ficou sem resposta', async () => {
      const api = fakeDefinitionsApi([service]);
      const store = await loadedStore(api);
      api.failNext({
        operation: 'update',
        kind: 'timeout',
        afterApplying: true,
      });
      const lost = await store.save({ definitions: [renamed] });

      const saved = await store.save({ definitions: [renamed] });

      expect(lost).toEqual(unavailable(API_ERROR_MESSAGES.timeout));
      expect(saved).toEqual({ ok: true });
      expect(api.stored('process-1')).toMatchObject({ revision: 2 });
    });

    it('reconhece a criação que chegou ao servidor e ficou sem resposta', async () => {
      const api = fakeDefinitionsApi();
      const store = await loadedStore(api);
      api.failNext({
        operation: 'create',
        kind: 'network',
        afterApplying: true,
      });
      await store.save({ definitions: [service] });

      const saved = await store.save({ definitions: [service] });

      expect(saved).toEqual({ ok: true });
      expect(api.stored('process-1')).toMatchObject({ revision: 1 });
    });

    it('trata como conflito o id novo que outro lugar já usou', async () => {
      const api = fakeDefinitionsApi();
      const store = await loadedStore(api);
      api.put(elsewhere);

      const saved = await store.save({ definitions: [renamed] });

      expect(saved).toEqual(CONFLICT);
    });

    it('devolve a recusa do servidor quando o processo novo é inválido para ele', async () => {
      const api = fakeDefinitionsApi();
      const store = await loadedStore(api);
      api.failNext({ operation: 'create', kind: 'invalid' });

      const saved = await store.save({ definitions: [service] });

      expect(saved).toEqual(unavailable(API_ERROR_MESSAGES.invalid));
    });

    it('devolve a falha da leitura quando não consegue conferir o id recusado', async () => {
      const api = fakeDefinitionsApi();
      const store = await loadedStore(api);
      api.failNext({ operation: 'create', kind: 'invalid' });
      api.failNext({ operation: 'get', kind: 'timeout' });

      const saved = await store.save({ definitions: [service] });

      expect(saved).toEqual(unavailable(API_ERROR_MESSAGES.timeout));
    });
  });
});

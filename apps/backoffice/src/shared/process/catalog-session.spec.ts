import { EMPTY_CATALOG, type ProcessCatalog } from './catalog';
import { createDefinition, renameDefinition } from './catalog-changes';
import { createCatalogSession } from './catalog-session';
import type {
  CatalogSession,
  CatalogSessionParams,
} from './catalog-session-contract';
import {
  type ScriptedCatalogStore,
  scriptedCatalogStore,
  storeFailure,
} from './catalog-session-test-store';
import type { CatalogFailure } from './catalog-store';
import { testDefinition } from './catalog-test-data';

const AT = '2026-11-26T15:00:00.000Z';

const stored: ProcessCatalog = { definitions: [testDefinition()] };
const elsewhere: ProcessCatalog = {
  definitions: [testDefinition({ name: 'Atendimento de outro lugar' })],
};

const OFFLINE: CatalogFailure = { kind: 'unavailable', message: 'sem rede' };
const CONFLICT: CatalogFailure = {
  kind: 'conflict',
  message: 'alterado em outro lugar',
  definitionId: 'process-1',
};

/** Mudança que cria o processo de nome `name`. */
function creating(name: string) {
  return (catalog: ProcessCatalog) =>
    createDefinition({ catalog, name, at: AT });
}

/** Mudança que renomeia o processo `process-1`. */
function renaming(name: string) {
  return (catalog: ProcessCatalog) =>
    renameDefinition({ catalog, definitionId: 'process-1', name, at: AT });
}

function names(catalog: ProcessCatalog | null | undefined): string[] {
  return catalog?.definitions.map((definition) => definition.name) ?? [];
}

function shown(session: CatalogSession): string[] {
  return names(session.getSnapshot().catalog);
}

interface Opened {
  readonly store: ScriptedCatalogStore;
  readonly session: CatalogSession;
}

type SessionOptions = Omit<CatalogSessionParams, 'store'>;

/** Sessão sobre o catálogo gravado, já com a primeira leitura feita. */
async function opened(
  initial: ProcessCatalog | null = stored,
  options: SessionOptions = {},
): Promise<Opened> {
  const store = scriptedCatalogStore(initial);
  const session = createCatalogSession({ store, ...options });
  await session.reload();
  return { store, session };
}

/** Sessão com uma gravação recusada por conflito, à espera da escolha. */
async function conflicted(): Promise<Opened> {
  const context = await opened();
  context.store.nextSaves.push(storeFailure(CONFLICT));
  context.session.update(renaming('Suporte'));
  await vi.waitFor(() =>
    expect(context.session.getSnapshot().conflict).toEqual(CONFLICT),
  );
  return context;
}

describe('createCatalogSession', () => {
  describe('leitura', () => {
    it('começa vazia e sem leitura', () => {
      const session = createCatalogSession({ store: scriptedCatalogStore() });

      expect(session.getSnapshot()).toEqual({
        catalog: EMPTY_CATALOG,
        loaded: false,
        loading: false,
        loadFailure: null,
        storageFailed: false,
        conflict: null,
      });
    });

    it('lê o catálogo gravado quando a tela aparece, mostrando que está lendo', async () => {
      const store = scriptedCatalogStore(stored);
      const session = createCatalogSession({ store });

      session.start();

      expect(session.getSnapshot().loading).toBe(true);
      await vi.waitFor(() => expect(session.getSnapshot().loaded).toBe(true));
      expect(session.getSnapshot()).toMatchObject({
        catalog: stored,
        loading: false,
      });
    });

    it('sem catálogo gravado, termina a leitura com o catálogo vazio', async () => {
      const { session } = await opened(null);

      expect(session.getSnapshot()).toMatchObject({
        catalog: EMPTY_CATALOG,
        loaded: true,
      });
    });

    it('faz uma leitura só quando a tela aparece duas vezes seguidas', async () => {
      const store = scriptedCatalogStore(stored);
      const session = createCatalogSession({ store });

      session.start();
      session.start();
      await vi.waitFor(() => expect(session.getSnapshot().loaded).toBe(true));

      expect(store.loads).toBe(1);
    });

    it('guarda o motivo quando a leitura falha, e a nova tentativa lê', async () => {
      const store = scriptedCatalogStore(stored);
      store.nextLoads.push(storeFailure(OFFLINE));
      const session = createCatalogSession({ store });

      const failed = await session.reload();
      const afterFailure = session.getSnapshot();
      const reloaded = await session.reload();

      expect(failed).toBeNull();
      expect(afterFailure).toMatchObject({
        loaded: false,
        loading: false,
        loadFailure: OFFLINE,
      });
      expect(reloaded).toBe(stored);
      expect(session.getSnapshot()).toMatchObject({
        loaded: true,
        loadFailure: null,
      });
    });

    it('tenta a primeira leitura de novo quando a tela reaparece depois da falha', async () => {
      const store = scriptedCatalogStore(stored);
      store.nextLoads.push(storeFailure(OFFLINE));
      const session = createCatalogSession({ store });
      await session.reload();

      session.start();

      await vi.waitFor(() => expect(session.getSnapshot().loaded).toBe(true));
    });

    it('avisa quem ouve a cada mudança, até a escuta ser encerrada', async () => {
      const store = scriptedCatalogStore(stored);
      const session = createCatalogSession({ store });
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      await session.reload();
      const calls = listener.mock.calls.length;
      unsubscribe();
      session.adopt(elsewhere);

      expect(calls).toBeGreaterThan(0);
      expect(listener).toHaveBeenCalledTimes(calls);
    });

    it('mostra o catálogo que o armazenamento avisa', async () => {
      const { session, store } = await opened();

      session.adopt(elsewhere);
      session.update(creating('Cobrança'));

      expect(shown(session)).toEqual([
        'Atendimento de outro lugar',
        'Cobrança',
      ]);
      await vi.waitFor(() => expect(store.saves).toHaveLength(1));
    });
  });

  describe('releitura automática', () => {
    it('relê quando a tela reaparece e conta o antes e o depois', async () => {
      const onRefreshed = vi.fn();
      const { session, store } = await opened(stored, { onRefreshed });
      store.stored = elsewhere;

      session.start();

      await vi.waitFor(() =>
        expect(session.getSnapshot().catalog).toBe(elsewhere),
      );
      expect(onRefreshed).toHaveBeenCalledExactlyOnceWith({
        before: stored,
        after: elsewhere,
      });
      expect(session.getSnapshot().loading).toBe(false);
    });

    it('não acontece antes da primeira leitura', async () => {
      const store = scriptedCatalogStore(stored);
      const session = createCatalogSession({ store });

      expect(await session.refresh()).toBeNull();
      expect(store.loads).toBe(0);
    });

    it('não acontece quando a tela pede para segurar', async () => {
      const { session, store } = await opened(stored, {
        holdRefresh: () => true,
      });

      expect(await session.refresh()).toBeNull();
      expect(store.loads).toBe(1);
    });

    it('não acontece com gravação que não foi feita, para não trazer o antigo', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(OFFLINE));
      session.update(creating('Cobrança'));
      await vi.waitFor(() =>
        expect(session.getSnapshot().storageFailed).toBe(true),
      );

      expect(await session.refresh()).toBeNull();
      expect(shown(session)).toEqual(['Atendimento', 'Cobrança']);
    });

    it('não acontece em conflito', async () => {
      const { session, store } = await conflicted();

      expect(await session.refresh()).toBeNull();
      expect(store.loads).toBe(1);
    });

    it('não acontece com gravação ou leitura a caminho', async () => {
      const { session, store } = await opened();
      const release = store.hold();
      session.update(creating('Cobrança'));

      const whileSaving = await session.refresh();
      release();
      await vi.waitFor(() => expect(store.pending).toBe(0));
      const hold = store.hold();
      const reading = session.reload();
      const whileReading = await session.refresh();
      hold();
      await reading;

      expect(whileSaving).toBeNull();
      expect(whileReading).toBeNull();
    });

    it('não vira aviso quando falha', async () => {
      const { session, store } = await opened();
      store.nextLoads.push(storeFailure(OFFLINE));

      expect(await session.refresh()).toBeNull();
      expect(session.getSnapshot()).toMatchObject({
        catalog: stored,
        loadFailure: null,
      });
    });

    it('desiste quando a tela muda enquanto relê', async () => {
      const { session, store } = await opened();
      store.stored = elsewhere;
      const release = store.hold();
      const refreshing = session.refresh();
      session.update(creating('Cobrança'));
      release();

      expect(await refreshing).toBeNull();
      expect(shown(session)).toEqual(['Atendimento', 'Cobrança']);
    });
  });

  describe('mudança', () => {
    it('aplica a mudança, devolve o resultado dela e manda gravar', async () => {
      const { session, store } = await opened();

      const created = session.update(creating('Cobrança'));

      expect(created).toMatchObject({ ok: true, definitionId: 'process-2' });
      expect(shown(session)).toEqual(['Atendimento', 'Cobrança']);
      expect(store.saves).toHaveLength(1);
      await vi.waitFor(() => expect(store.pending).toBe(0));
      expect(names(store.stored)).toEqual(['Atendimento', 'Cobrança']);
    });

    it('devolve a recusa sem mudar nem gravar', async () => {
      const { session, store } = await opened();

      const refused = session.update(creating('atendimento'));

      expect(refused).toMatchObject({
        ok: false,
        refusal: { code: 'name-taken' },
      });
      expect(store.saves).toEqual([]);
    });

    it('não grava a mudança que deixa o catálogo como estava', async () => {
      const { session, store } = await opened();

      session.update(renaming('Atendimento'));

      expect(store.saves).toEqual([]);
    });

    it('aplica a segunda mudança sobre o resultado da primeira', async () => {
      const { session, store } = await opened();

      session.update(creating('Cobrança'));
      session.update(creating('Compras'));

      await vi.waitFor(() => expect(store.pending).toBe(0));
      expect(names(store.stored)).toEqual([
        'Atendimento',
        'Cobrança',
        'Compras',
      ]);
    });

    it('mostra a mudança pedida antes da primeira leitura e a refaz sobre o catálogo lido', async () => {
      const store = scriptedCatalogStore(stored);
      const session = createCatalogSession({ store });

      const early = session.update(creating('Cobrança'));
      session.update(creating('Compras'));
      const beforeReading = shown(session);
      await session.reload();

      expect(early).toMatchObject({ ok: true, definitionId: 'process-1' });
      expect(beforeReading).toEqual(['Cobrança', 'Compras']);
      expect(shown(session)).toEqual(['Atendimento', 'Cobrança', 'Compras']);
      expect(names(store.stored)).toEqual([
        'Atendimento',
        'Cobrança',
        'Compras',
      ]);
    });

    it('deixa de fora a mudança antecipada que o catálogo lido recusa', async () => {
      const store = scriptedCatalogStore(stored);
      const session = createCatalogSession({ store });

      session.update(creating('Atendimento'));
      await session.reload();

      expect(shown(session)).toEqual(['Atendimento']);
      expect(store.saves).toEqual([]);
    });
  });

  describe('falha de gravação', () => {
    it('vira estado e mantém a mudança na memória', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(OFFLINE));

      session.update(creating('Cobrança'));

      await vi.waitFor(() =>
        expect(session.getSnapshot().storageFailed).toBe(true),
      );
      expect(shown(session)).toEqual(['Atendimento', 'Cobrança']);
      expect(names(store.stored)).toEqual(['Atendimento']);
    });

    it('some quando a gravação seguinte dá certo', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(OFFLINE));
      session.update(creating('Cobrança'));

      session.update(creating('Compras'));

      await vi.waitFor(() =>
        expect(names(store.stored)).toEqual([
          'Atendimento',
          'Cobrança',
          'Compras',
        ]),
      );
      expect(session.getSnapshot().storageFailed).toBe(false);
    });

    it('some quando a nova tentativa grava', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(OFFLINE));
      session.update(creating('Cobrança'));
      await vi.waitFor(() =>
        expect(session.getSnapshot().storageFailed).toBe(true),
      );

      const saved = await session.retrySave();

      expect(saved).toBe(true);
      expect(session.getSnapshot().storageFailed).toBe(false);
      expect(names(store.stored)).toEqual(['Atendimento', 'Cobrança']);
    });

    it('continua quando a nova tentativa também falha', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(OFFLINE), storeFailure(OFFLINE));
      session.update(creating('Cobrança'));
      await vi.waitFor(() =>
        expect(session.getSnapshot().storageFailed).toBe(true),
      );

      expect(await session.retrySave()).toBe(false);
      expect(session.getSnapshot().storageFailed).toBe(true);
    });

    it('não tem o que tentar de novo antes da primeira leitura', async () => {
      const store = scriptedCatalogStore(stored);
      const session = createCatalogSession({ store });

      expect(await session.retrySave()).toBe(false);
      expect(await session.keepMine()).toBe(false);
      expect(store.saves).toEqual([]);
    });
  });

  describe('mudança que espera a gravação', () => {
    it('devolve o resultado da mudança depois de gravar', async () => {
      const { session, store } = await opened();

      const outcome = await session.commit(creating('Cobrança'));

      expect(outcome).toMatchObject({
        kind: 'saved',
        result: { ok: true, definitionId: 'process-2' },
      });
      expect(names(store.stored)).toEqual(['Atendimento', 'Cobrança']);
    });

    it('devolve a recusa sem gravar', async () => {
      const { session, store } = await opened();

      const outcome = await session.commit(creating('atendimento'));

      expect(outcome).toMatchObject({
        kind: 'refused',
        refusal: { code: 'name-taken' },
      });
      expect(store.saves).toEqual([]);
    });

    it('não grava a mudança que deixa o catálogo como estava', async () => {
      const { session, store } = await opened();

      const outcome = await session.commit(renaming('Atendimento'));

      expect(outcome.kind).toBe('saved');
      expect(store.saves).toEqual([]);
    });

    it('falha antes da primeira leitura', async () => {
      const session = createCatalogSession({ store: scriptedCatalogStore() });

      const outcome = await session.commit(creating('Cobrança'));

      expect(outcome).toEqual({
        kind: 'failed',
        failure: {
          kind: 'unavailable',
          message: 'O catálogo de processos ainda não foi lido.',
        },
      });
    });

    it('tira a mudança da tela quando a gravação falha, sem marcar o catálogo como não gravado', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(OFFLINE));

      const outcome = await session.commit(creating('Cobrança'));

      expect(outcome).toEqual({ kind: 'failed', failure: OFFLINE });
      expect(session.getSnapshot()).toMatchObject({
        catalog: stored,
        storageFailed: false,
      });
    });

    it('grava na nova tentativa depois da falha', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(OFFLINE));
      await session.commit(creating('Cobrança'));

      const outcome = await session.commit(creating('Cobrança'));

      expect(outcome.kind).toBe('saved');
      expect(names(store.stored)).toEqual(['Atendimento', 'Cobrança']);
    });

    it('mantém a mudança na tela quando outra veio antes de a gravação falhar', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(OFFLINE), storeFailure(OFFLINE));
      const release = store.hold();

      const committing = session.commit(creating('Cobrança'));
      session.update(creating('Compras'));
      release();

      expect(await committing).toEqual({ kind: 'failed', failure: OFFLINE });
      await vi.waitFor(() => expect(store.pending).toBe(0));
      expect(shown(session)).toEqual(['Atendimento', 'Cobrança', 'Compras']);
      expect(session.getSnapshot().storageFailed).toBe(true);
    });

    it('grava o que ficou só na tela quando a mudança seguinte não muda nada', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(OFFLINE));
      session.update(creating('Cobrança'));
      await vi.waitFor(() =>
        expect(session.getSnapshot().storageFailed).toBe(true),
      );

      const outcome = await session.commit(renaming('Atendimento'));

      expect(outcome.kind).toBe('saved');
      expect(session.getSnapshot().storageFailed).toBe(false);
      expect(names(store.stored)).toEqual(['Atendimento', 'Cobrança']);
    });

    it('segue sem gravar quando essa gravação também falha', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(OFFLINE), storeFailure(OFFLINE));
      session.update(creating('Cobrança'));
      await vi.waitFor(() =>
        expect(session.getSnapshot().storageFailed).toBe(true),
      );

      const outcome = await session.commit(renaming('Atendimento'));

      expect(outcome).toEqual({ kind: 'failed', failure: OFFLINE });
      expect(shown(session)).toEqual(['Atendimento', 'Cobrança']);
      expect(session.getSnapshot().storageFailed).toBe(true);
    });
  });

  describe('conflito', () => {
    it('vira estado, sem marcar falha de gravação, e mantém a mudança na tela', async () => {
      const { session } = await conflicted();

      expect(session.getSnapshot()).toMatchObject({
        conflict: CONFLICT,
        storageFailed: false,
      });
      expect(shown(session)).toEqual(['Suporte']);
    });

    it('não envia as mudanças seguintes enquanto espera a escolha', async () => {
      const { session, store } = await conflicted();

      session.update(creating('Cobrança'));

      expect(store.saves).toHaveLength(1);
      expect(shown(session)).toEqual(['Suporte', 'Cobrança']);
    });

    it('manter grava por cima o catálogo da tela e encerra o conflito', async () => {
      const { session, store } = await conflicted();
      session.update(creating('Cobrança'));

      const kept = await session.keepMine();

      expect(kept).toBe(true);
      expect(names(store.overwrites[0])).toEqual(['Suporte', 'Cobrança']);
      expect(session.getSnapshot()).toMatchObject({
        conflict: null,
        storageFailed: false,
      });
    });

    it('manter grava de novo quando a tela muda durante a gravação', async () => {
      const { session, store } = await conflicted();
      const release = store.hold();

      const keeping = session.keepMine();
      session.update(creating('Cobrança'));
      release();

      expect(await keeping).toBe(true);
      expect(store.overwrites.map(names)).toEqual([
        ['Suporte'],
        ['Suporte', 'Cobrança'],
      ]);
    });

    it('continua esperando a escolha quando o manter não chega ao armazenamento', async () => {
      const { session, store } = await conflicted();
      store.nextSaves.push(storeFailure(OFFLINE));

      const kept = await session.keepMine();

      expect(kept).toBe(false);
      expect(session.getSnapshot()).toMatchObject({
        conflict: CONFLICT,
        storageFailed: false,
      });
    });

    it('troca o conflito pelo novo quando o manter encontra outro', async () => {
      const { session, store } = await conflicted();
      const again: CatalogFailure = { ...CONFLICT, message: 'de novo' };
      store.nextSaves.push(storeFailure(again));

      const kept = await session.keepMine();

      expect(kept).toBe(false);
      expect(session.getSnapshot().conflict).toEqual(again);
    });

    it('recarregar traz o que está gravado e descarta o que a tela tinha', async () => {
      const { session, store } = await conflicted();
      store.stored = elsewhere;

      const reloaded = await session.reload();

      expect(reloaded).toBe(elsewhere);
      expect(session.getSnapshot()).toMatchObject({
        catalog: elsewhere,
        conflict: null,
      });
    });

    it('a mudança que espera a gravação fica esperando a escolha e é gravada ao manter', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(CONFLICT));

      const committing = session.commit(renaming('Suporte'));
      await vi.waitFor(() =>
        expect(session.getSnapshot().conflict).toEqual(CONFLICT),
      );
      await session.keepMine();

      expect(await committing).toMatchObject({ kind: 'saved' });
      expect(names(store.stored)).toEqual(['Suporte']);
    });

    it('a mudança que espera a gravação é descartada ao recarregar', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(CONFLICT));

      const committing = session.commit(renaming('Suporte'));
      await vi.waitFor(() =>
        expect(session.getSnapshot().conflict).toEqual(CONFLICT),
      );
      await session.reload();

      expect(await committing).toEqual({ kind: 'discarded' });
      expect(shown(session)).toEqual(['Atendimento']);
    });

    it('a mudança pedida durante o conflito espera a escolha sem enviar nada', async () => {
      const { session, store } = await conflicted();

      const committing = session.commit(creating('Cobrança'));
      const waiting = await session.refresh();
      await session.keepMine();

      expect(waiting).toBeNull();
      expect(await committing).toMatchObject({ kind: 'saved' });
      expect(store.saves).toHaveLength(1);
      expect(names(store.stored)).toEqual(['Suporte', 'Cobrança']);
    });

    it('a nova tentativa de gravação que encontra conflito passa a esperar a escolha', async () => {
      const { session, store } = await opened();
      store.nextSaves.push(storeFailure(OFFLINE), storeFailure(CONFLICT));
      session.update(renaming('Suporte'));
      await vi.waitFor(() =>
        expect(session.getSnapshot().storageFailed).toBe(true),
      );

      expect(await session.retrySave()).toBe(false);
      expect(session.getSnapshot().conflict).toEqual(CONFLICT);
    });
  });
});

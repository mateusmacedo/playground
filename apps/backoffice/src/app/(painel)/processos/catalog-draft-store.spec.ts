import type { ProcessCatalog } from '@/shared/process/catalog';
import { createCatalogSession } from '@/shared/process/catalog-session';
import {
  testDefinition,
  testVersion,
} from '@/shared/process/catalog-test-data';

import {
  createCatalogDraftStore,
  draftOpeningText,
} from './catalog-draft-store';
import { memoryCatalogStore } from './catalog-test-store';

const AT = '2026-11-26T12:00:00.000Z';

/** Rascunho do `process-1` sobre a tela que já leu o catálogo gravado. */
async function draftStore(stored: ProcessCatalog) {
  const catalogStore = memoryCatalogStore(stored);
  const session = createCatalogSession({ store: catalogStore });
  await session.reload();
  const store = createCatalogDraftStore({
    definitionId: 'process-1',
    current: () => session.getSnapshot().catalog,
    commit: session.commit,
    now: () => AT,
  });
  return { catalogStore, session, store };
}

describe('draftOpeningText', () => {
  it('é o rascunho do processo', () => {
    const catalog = {
      definitions: [
        testDefinition({ draftText: 'rascunho', versions: [testVersion(1)] }),
      ],
    };

    expect(draftOpeningText({ catalog, definitionId: 'process-1' })).toBe(
      'rascunho',
    );
  });

  it('não existe para o processo que não está no catálogo', () => {
    const catalog = { definitions: [testDefinition()] };

    expect(draftOpeningText({ catalog, definitionId: 'process-9' })).toBeNull();
  });
});

describe('createCatalogDraftStore', () => {
  it('abre o rascunho do processo, pelo catálogo da tela', async () => {
    const { store } = await draftStore({
      definitions: [testDefinition({ draftText: 'meu rascunho' })],
    });

    expect(store.load()).toBe('meu rascunho');
  });

  it('abre a última versão publicada quando não há rascunho', async () => {
    const { store } = await draftStore({
      definitions: [
        testDefinition({ versions: [testVersion(1), testVersion(3)] }),
      ],
    });

    expect(store.load()).toBe('documento v3');
  });

  it('não tem o que abrir sem rascunho e sem versão, ou sem o processo', async () => {
    const empty = await draftStore({ definitions: [testDefinition()] });
    const missing = await draftStore({ definitions: [] });

    expect(empty.store.load()).toBeNull();
    expect(missing.store.load()).toBeNull();
  });

  it('grava o rascunho no catálogo da tela, preservando os outros processos', async () => {
    const { catalogStore, session, store } = await draftStore({
      definitions: [
        testDefinition({ draftText: 'texto antigo' }),
        testDefinition({ id: 'process-2', name: 'Cobrança' }),
      ],
    });

    await store.save('texto novo');

    expect(catalogStore.saved?.definitions).toHaveLength(2);
    expect(catalogStore.saved?.definitions[0].draftText).toBe('texto novo');
    expect(catalogStore.saved?.definitions[0].updatedAt).toBe(AT);
    expect(session.getSnapshot().catalog).toBe(catalogStore.saved);
  });

  it('grava sobre o que a tela tem, inclusive o que outra aba mudou e ela já mostrou', async () => {
    const { catalogStore, session, store } = await draftStore({
      definitions: [testDefinition()],
    });
    session.adopt({
      definitions: [testDefinition({ name: 'Renomeado em outra aba' })],
    });

    await store.save('texto novo');

    expect(catalogStore.saved?.definitions[0]).toMatchObject({
      name: 'Renomeado em outra aba',
      draftText: 'texto novo',
    });
  });

  it('rejeita quando o processo não existe mais', async () => {
    const { catalogStore, store } = await draftStore({ definitions: [] });

    await expect(store.save('texto novo')).rejects.toThrow(
      'Processo não encontrado no catálogo.',
    );
    expect(catalogStore.saved?.definitions).toEqual([]);
  });

  it('rejeita quando a gravação não é feita, e o catálogo da tela volta ao que estava gravado', async () => {
    const { catalogStore, session, store } = await draftStore({
      definitions: [testDefinition({ draftText: 'texto antigo' })],
    });
    catalogStore.failNext = true;

    await expect(store.save('texto novo')).rejects.toThrow('cota cheia');
    expect(session.getSnapshot().catalog.definitions[0].draftText).toBe(
      'texto antigo',
    );
  });

  it('rejeita quando a mudança é descartada ao recarregar o processo em conflito', async () => {
    const { catalogStore, session, store } = await draftStore({
      definitions: [testDefinition()],
    });
    vi.spyOn(catalogStore, 'save').mockResolvedValueOnce({
      ok: false,
      failure: { kind: 'conflict', message: 'alterado em outro lugar' },
    });

    const saving = store.save('texto novo');
    await vi.waitFor(() =>
      expect(session.getSnapshot().conflict).not.toBeNull(),
    );
    await session.reload();

    await expect(saving).rejects.toThrow(
      'O rascunho foi descartado ao recarregar o processo.',
    );
  });
});

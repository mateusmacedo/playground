import type { ProcessCatalog } from './catalog';
import { serializeCatalog } from './catalog-format';
import {
  CATALOG_STORAGE_KEY,
  createBrowserCatalogStore,
} from './catalog-store';
import { testDefinition, testVersion } from './catalog-test-data';

const KEY = 'teste:catalogo';

const catalog: ProcessCatalog = {
  definitions: [
    testDefinition({ draftText: 'rascunho', versions: [testVersion(1)] }),
  ],
};

const other: ProcessCatalog = {
  definitions: [testDefinition({ id: 'process-2', name: 'Cobrança' })],
};

interface OtherTabWriteParams {
  readonly key: string;
  readonly newValue: string | null;
}

/** O aviso que o navegador dá a esta aba quando outra grava ou apaga a chave. */
function writeFromOtherTab(params: OtherTabWriteParams): void {
  window.dispatchEvent(new StorageEvent('storage', params));
}

describe('createBrowserCatalogStore', () => {
  const subscriptions: (() => void)[] = [];

  /** Passa a ouvir o catálogo da chave de teste; a escuta é encerrada ao fim do teste. */
  function listen() {
    const listener = vi.fn();
    subscriptions.push(createBrowserCatalogStore(KEY).subscribe(listener));
    return listener;
  }

  afterEach(() => {
    for (const unsubscribe of subscriptions.splice(0)) {
      unsubscribe();
    }
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('grava e lê o catálogo na chave dele', async () => {
    const store = createBrowserCatalogStore(KEY);

    const saved = await store.save(catalog);

    expect(saved).toEqual({ ok: true });
    expect(await store.load()).toEqual({ ok: true, catalog });
    expect(window.localStorage.getItem(KEY)).toBe(serializeCatalog(catalog));
  });

  it('grava por cima do catálogo gravado, como a gravação comum', async () => {
    const store = createBrowserCatalogStore(KEY);
    await store.save(catalog);

    const saved = await store.overwrite(other);

    expect(saved).toEqual({ ok: true });
    expect(await store.load()).toEqual({ ok: true, catalog: other });
  });

  it('usa a chave do catálogo do painel quando nenhuma é informada', async () => {
    await createBrowserCatalogStore().save(catalog);

    expect(CATALOG_STORAGE_KEY).toBe('backoffice:processos:catalogo:v1');
    expect(window.localStorage.getItem(CATALOG_STORAGE_KEY)).toBe(
      serializeCatalog(catalog),
    );
  });

  it('não lê nada enquanto não há catálogo gravado', async () => {
    const read = await createBrowserCatalogStore(KEY).load();

    expect(read).toEqual({ ok: true, catalog: null });
  });

  it('trata o catálogo gravado ilegível como sem catálogo', async () => {
    window.localStorage.setItem(KEY, '{quebrado');

    const read = await createBrowserCatalogStore(KEY).load();

    expect(read).toEqual({ ok: true, catalog: null });
  });

  it('trata armazenamento bloqueado como sem catálogo', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });

    const read = await createBrowserCatalogStore(KEY).load();

    expect(read).toEqual({ ok: true, catalog: null });
  });

  it('devolve a falha da gravação recusada pelo navegador, sem avisar ninguém', async () => {
    const listener = listen();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });

    const saved = await createBrowserCatalogStore(KEY).save(catalog);

    expect(saved).toEqual({
      ok: false,
      failure: {
        kind: 'unavailable',
        message: 'O navegador recusou a gravação do catálogo de processos.',
      },
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it('avisa quem ouve quando outra tela da mesma aba grava', async () => {
    const listener = listen();

    await createBrowserCatalogStore(KEY).save(catalog);

    expect(listener).toHaveBeenCalledExactlyOnceWith(catalog);
  });

  it('avisa quem ouve quando outra aba grava', () => {
    const listener = listen();

    writeFromOtherTab({ key: KEY, newValue: serializeCatalog(other) });

    expect(listener).toHaveBeenCalledExactlyOnceWith(other);
  });

  it('ignora a gravação de outra chave', () => {
    const listener = listen();

    writeFromOtherTab({
      key: 'outra:chave',
      newValue: serializeCatalog(other),
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it.each([
    ['apagado', null],
    ['ilegível', '{quebrado'],
  ])('ignora o aviso de catálogo %s', (_case, newValue) => {
    const listener = listen();

    writeFromOtherTab({ key: KEY, newValue });

    expect(listener).not.toHaveBeenCalled();
  });

  it('para de avisar depois que a escuta é encerrada', () => {
    const listener = vi.fn();
    const unsubscribe = createBrowserCatalogStore(KEY).subscribe(listener);

    unsubscribe();
    writeFromOtherTab({ key: KEY, newValue: serializeCatalog(other) });

    expect(listener).not.toHaveBeenCalled();
  });
});

import type { ProcessCatalog } from '@/shared/process/catalog';
import type {
  CatalogListener,
  CatalogSaveResult,
  CatalogStore,
} from '@/shared/process/catalog-store';

/** Catálogo em memória para os testes, com a gravação que pode falhar uma vez e o aviso a quem ouve. */
export interface MemoryCatalogStore extends CatalogStore {
  saved: ProcessCatalog | null;
  /** A próxima gravação falha, como o navegador com a cota cheia. */
  failNext: boolean;
  /** A leitura não devolve catálogo, como o armazenamento bloqueado. */
  blocked: boolean;
}

export function memoryCatalogStore(
  initial: ProcessCatalog | null = null,
): MemoryCatalogStore {
  const listeners = new Set<CatalogListener>();

  async function save(catalog: ProcessCatalog): Promise<CatalogSaveResult> {
    if (store.failNext) {
      store.failNext = false;
      return {
        ok: false,
        failure: { kind: 'unavailable', message: 'cota cheia' },
      };
    }
    store.saved = catalog;
    for (const listener of listeners) {
      listener(catalog);
    }
    return { ok: true };
  }

  const store: MemoryCatalogStore = {
    saved: initial,
    failNext: false,
    blocked: false,
    load: async () => ({
      ok: true,
      catalog: store.blocked ? null : store.saved,
    }),
    save,
    overwrite: save,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return store;
}

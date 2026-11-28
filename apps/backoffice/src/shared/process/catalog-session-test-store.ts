import type { ProcessCatalog } from './catalog';
import type {
  CatalogFailed,
  CatalogFailure,
  CatalogLoadResult,
  CatalogSaveResult,
  CatalogStore,
} from './catalog-store';

/** Falha de leitura ou gravação com a mensagem dada, para combinar com o armazenamento dos testes. */
export function storeFailure(failure: CatalogFailure): CatalogFailed {
  return { ok: false, failure };
}

/** Armazenamento em memória para os testes, com resultados combinados e operações que esperam uma liberação. */
export interface ScriptedCatalogStore extends CatalogStore {
  stored: ProcessCatalog | null;
  /** Quantas leituras foram pedidas. */
  loads: number;
  /** Quantas leituras e gravações ainda não terminaram. */
  pending: number;
  /** Catálogos mandados gravar, na ordem. */
  readonly saves: ProcessCatalog[];
  /** Catálogos mandados gravar por cima, na ordem. */
  readonly overwrites: ProcessCatalog[];
  /** Resultados das próximas leituras; sem nenhum combinado, a leitura devolve o que está guardado. */
  readonly nextLoads: CatalogLoadResult[];
  /** Resultados das próximas gravações; sem nenhum combinado, a gravação dá certo. */
  readonly nextSaves: CatalogSaveResult[];
  /** Faz as operações seguintes esperarem; devolve a função que as libera. */
  readonly hold: () => () => void;
}

export function scriptedCatalogStore(
  initial: ProcessCatalog | null = null,
): ScriptedCatalogStore {
  let gate: Promise<void> = Promise.resolve();

  async function write(catalog: ProcessCatalog): Promise<CatalogSaveResult> {
    const planned = store.nextSaves.shift() ?? { ok: true };
    store.pending += 1;
    await gate;
    store.pending -= 1;
    if (planned.ok) {
      store.stored = catalog;
    }
    return planned;
  }

  const store: ScriptedCatalogStore = {
    stored: initial,
    loads: 0,
    pending: 0,
    saves: [],
    overwrites: [],
    nextLoads: [],
    nextSaves: [],
    hold() {
      let open: () => void = () => undefined;
      gate = new Promise<void>((resolve) => {
        open = resolve;
      });
      return () => open();
    },
    async load() {
      store.loads += 1;
      const planned = store.nextLoads.shift();
      store.pending += 1;
      await gate;
      store.pending -= 1;
      return planned ?? { ok: true, catalog: store.stored };
    },
    save(catalog) {
      store.saves.push(catalog);
      return write(catalog);
    },
    overwrite(catalog) {
      store.overwrites.push(catalog);
      return write(catalog);
    },
    subscribe: () => () => undefined,
  };
  return store;
}

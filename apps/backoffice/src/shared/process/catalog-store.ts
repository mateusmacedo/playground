import type { ProcessCatalog } from './catalog';
import { parseCatalog, serializeCatalog } from './catalog-format';

export type CatalogListener = (catalog: ProcessCatalog) => void;

export type CatalogFailureKind =
  /** Não deu para ler ou gravar: sem rede, servidor fora do ar, navegador que recusa a gravação. */
  | 'unavailable'
  /** O processo foi alterado em outro lugar depois de lido, e a gravação dele não foi feita. */
  | 'conflict';

/** Por que o catálogo não pôde ser lido ou gravado. */
export interface CatalogFailure {
  readonly kind: CatalogFailureKind;
  /** Motivo em PT-BR, pronto para a tela. */
  readonly message: string;
  /** No conflito, o processo que foi alterado em outro lugar. */
  readonly definitionId?: string;
}

export interface CatalogFailed {
  readonly ok: false;
  readonly failure: CatalogFailure;
}

export interface CatalogRead {
  readonly ok: true;
  /** Catálogo gravado; `null` sem catálogo, com o gravado ilegível ou com o armazenamento bloqueado. */
  readonly catalog: ProcessCatalog | null;
}

export interface CatalogWritten {
  readonly ok: true;
}

/** Resultado de uma leitura do catálogo: o catálogo ou a falha, nunca exceção. */
export type CatalogLoadResult = CatalogRead | CatalogFailed;
/** Resultado de uma gravação do catálogo: feita ou a falha, nunca exceção. */
export type CatalogSaveResult = CatalogWritten | CatalogFailed;

/**
 * Onde o catálogo é guardado. As telas só conhecem esta porta; os adaptadores são o `localStorage` do navegador e a
 * API do painel (`catalog-http-store`).
 */
export interface CatalogStore {
  readonly load: () => Promise<CatalogLoadResult>;
  /** Grava o catálogo. O processo alterado em outro lugar depois de lido não é gravado: a falha é `conflict`. */
  readonly save: (catalog: ProcessCatalog) => Promise<CatalogSaveResult>;
  /** Grava o catálogo por cima do que estiver gravado; é como um conflito se resolve a favor desta tela. */
  readonly overwrite: (catalog: ProcessCatalog) => Promise<CatalogSaveResult>;
  /**
   * Chama `listener` a cada catálogo gravado por outra tela desta aba ou por outra aba, quando o adaptador fica
   * sabendo disso. Devolve a função que para de ouvir.
   */
  readonly subscribe: (listener: CatalogListener) => () => void;
}

/** Chave do catálogo no `localStorage`; a versão do formato vai dentro do valor gravado. */
export const CATALOG_STORAGE_KEY = 'backoffice:processos:catalogo:v1';

const WRITE_REFUSED: CatalogFailed = {
  ok: false,
  failure: {
    kind: 'unavailable',
    message: 'O navegador recusou a gravação do catálogo de processos.',
  },
};

export function createBrowserCatalogStore(
  key: string = CATALOG_STORAGE_KEY,
): CatalogStore {
  async function save(catalog: ProcessCatalog): Promise<CatalogSaveResult> {
    const text = serializeCatalog(catalog);
    try {
      window.localStorage.setItem(key, text);
    } catch {
      // WHY: cota cheia ou armazenamento bloqueado viram resultado, para a tela avisar e manter o que tem na memória.
      return WRITE_REFUSED;
    }
    // NOTE: o navegador só avisa as outras abas da gravação; este evento leva o mesmo aviso às telas desta aba, que
    // também leem o catálogo (o editor grava e o quadro lê).
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: text }));
    return { ok: true };
  }

  return {
    async load() {
      try {
        return {
          ok: true,
          catalog: parseCatalog(window.localStorage.getItem(key)),
        };
      } catch {
        // WHY: armazenamento bloqueado (modo privado, política do navegador) é o mesmo que não ter catálogo.
        return { ok: true, catalog: null };
      }
    },
    save,
    // NOTE: o navegador guarda o catálogo inteiro e não confere quem gravou antes: gravar já é gravar por cima.
    overwrite: save,
    subscribe(listener) {
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) {
          return;
        }
        const catalog = parseCatalog(event.newValue);
        if (catalog !== null) {
          listener(catalog);
        }
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },
  };
}

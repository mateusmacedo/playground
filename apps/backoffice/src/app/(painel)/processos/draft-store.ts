/** Onde o rascunho é guardado. A tela só conhece esta porta; hoje o adaptador é o `localStorage` do navegador. */
export interface DraftStore {
  /** Texto salvo, `null` sem rascunho ou com o armazenamento bloqueado. */
  readonly load: () => string | null;
  /** Grava o texto; rejeita quando o navegador recusa (cota cheia, armazenamento bloqueado). */
  readonly save: (text: string) => Promise<void>;
}

export const DRAFT_KEY = 'playground:processos:draft:v1';

export function createBrowserDraftStore(key: string = DRAFT_KEY): DraftStore {
  return {
    load() {
      try {
        return window.localStorage.getItem(key);
      } catch {
        // WHY: armazenamento bloqueado (modo privado, política do navegador) é o mesmo que não ter rascunho.
        return null;
      }
    },
    async save(text) {
      window.localStorage.setItem(key, text);
    },
  };
}

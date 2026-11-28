import { CATALOG_STORAGE_KEY } from '@/shared/process/catalog-store';

/** Processo aberto por último nesta aba, para o editor voltar a ele. É conveniência: falhar é o mesmo que esquecer. */
export interface ActiveProcessStore {
  /** Id do processo aberto por último; `null` sem registro ou com o armazenamento bloqueado. */
  readonly load: () => string | null;
  readonly save: (definitionId: string) => void;
}

export const ACTIVE_PROCESS_KEY = `${CATALOG_STORAGE_KEY}:ativo`;

/** Adaptador sobre o `sessionStorage`, que vale só para a aba. */
export function createSessionActiveProcessStore(
  key: string = ACTIVE_PROCESS_KEY,
): ActiveProcessStore {
  return {
    load() {
      try {
        return window.sessionStorage.getItem(key);
      } catch {
        // WHY: armazenamento bloqueado é o mesmo que não ter registro; o editor abre o primeiro processo.
        return null;
      }
    },
    save(definitionId) {
      try {
        window.sessionStorage.setItem(key, definitionId);
      } catch {
        // WHY: sem o registro, a próxima abertura desta aba só não volta ao mesmo processo; não há o que avisar.
      }
    },
  };
}

import { SAVED, type SaveStatus } from './board-store';

export interface StatusChannel {
  readonly get: () => SaveStatus;
  /** Troca a situação e avisa quem ouve; a situação igual à atual não avisa ninguém. */
  readonly set: (next: SaveStatus) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

function isSameStatus(a: SaveStatus, b: SaveStatus): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A situação da gravação de um quadro, com aviso a cada mudança: é o que a tela acompanha. */
export function createStatusChannel(): StatusChannel {
  let status = SAVED;
  const listeners = new Set<() => void>();

  return {
    get: () => status,
    set(next) {
      if (isSameStatus(status, next)) {
        return;
      }
      status = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

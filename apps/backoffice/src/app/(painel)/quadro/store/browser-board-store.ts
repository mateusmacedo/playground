import {
  readStorage,
  subscribeStorage,
  writeStorage,
} from '../browser-storage';
import type { Board } from '../model/board';
import { parseStoredBoard, serializeBoard } from '../model/storage';
import { type BoardStore, SAVED, type SaveStatus } from './board-store';
import { createStatusChannel } from './status-channel';

export const STORAGE_FULL: SaveStatus = {
  kind: 'failed',
  message:
    'O navegador não tem mais espaço para gravar este quadro: as últimas mudanças só valem até fechar a página. Remova anexos grandes ou arquivados para liberar espaço.',
  busy: false,
};

/** O quadro gravado no `localStorage`, na chave dada: lê ao abrir, acompanha as outras abas e grava cada mudança na hora. */
export function createBrowserBoardStore(storageKey: string): BoardStore {
  const channel = createStatusChannel();
  /** Último quadro lido do navegador, que não precisa ser gravado de volta. */
  let fromStorage: Board | null = null;

  const read = (raw: string | null): Board | null => {
    const stored = parseStoredBoard(raw);
    if (stored) {
      fromStorage = stored;
    }
    return stored;
  };

  return {
    async load() {
      const board = read(readStorage(storageKey));
      return board ? { kind: 'found', board } : { kind: 'empty' };
    },
    watch(onChange) {
      return subscribeStorage({
        key: storageKey,
        onChange: (raw) => {
          const board = read(raw);
          if (board) {
            onChange(board);
          }
        },
      });
    },
    save(board) {
      // NOTE: regravar o que veio de outra aba devolveria a ela, com outra ordem de campos, uma mudança que não houve.
      if (board === fromStorage) {
        return;
      }
      const saved = writeStorage({
        key: storageKey,
        value: serializeBoard(board),
      });
      channel.set(saved ? SAVED : STORAGE_FULL);
    },
    status: channel.get,
    subscribe: channel.subscribe,
  };
}

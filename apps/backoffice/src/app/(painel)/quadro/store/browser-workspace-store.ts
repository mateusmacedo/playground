import {
  readStorage,
  removeStorage,
  subscribeStorage,
  writeStorage,
} from '../browser-storage';
import { serializeBoard } from '../model/storage';
import {
  BOARDS_STORAGE_KEY,
  boardStorageKey,
  DEFAULT_BOARDS,
  parseStoredBoards,
  serializeBoards,
  type WorkspaceBoard,
} from '../model/workspace';
import type { BoardStore } from './board-store';
import { createBrowserBoardStore } from './browser-board-store';
import type { WorkspaceStore } from './workspace-store';

function saveList(boards: readonly WorkspaceBoard[]): void {
  writeStorage({ key: BOARDS_STORAGE_KEY, value: serializeBoards(boards) });
}

/**
 * Os quadros gravados no `localStorage`: a lista numa chave, compartilhada entre as abas, e o conteúdo de cada quadro
 * na chave dele.
 */
export function createBrowserWorkspaceStore(): WorkspaceStore {
  const boardStores = new Map<string, BoardStore>();

  return {
    async loadList() {
      const stored = parseStoredBoards(readStorage(BOARDS_STORAGE_KEY));
      if (stored) {
        return { kind: 'found', boards: stored };
      }
      // NOTE: sem lista gravada, ou com ela estragada, vale o quadro principal, e a lista passa a existir no navegador.
      saveList(DEFAULT_BOARDS);
      return { kind: 'found', boards: DEFAULT_BOARDS };
    },
    watchList(onChange) {
      return subscribeStorage({
        key: BOARDS_STORAGE_KEY,
        onChange: (raw) => {
          const boards = parseStoredBoards(raw);
          if (boards) {
            onChange(boards);
          }
        },
      });
    },
    create({ boards, board, content }) {
      // NOTE: o conteúdo é gravado antes da lista, para o quadro novo já abrir com a configuração escolhida.
      writeStorage({
        key: boardStorageKey(board.id),
        value: serializeBoard(content),
      });
      saveList(boards);
    },
    rename({ boards }) {
      saveList(boards);
    },
    async remove({ boards, boardId }) {
      removeStorage(boardStorageKey(boardId));
      boardStores.delete(boardId);
      saveList(boards);
      return null;
    },
    board(boardId) {
      const existing = boardStores.get(boardId);
      if (existing) {
        return existing;
      }
      const store = createBrowserBoardStore(boardStorageKey(boardId));
      boardStores.set(boardId, store);
      return store;
    },
  };
}

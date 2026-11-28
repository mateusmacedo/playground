import type { BoardsApi } from '@/shared/api/boards-api';

import type { Board } from '../model/board';
import { DEFAULT_BOARD, DEFAULT_BOARDS } from '../model/workspace';
import { createHttpBoardStore, type HttpBoardStore } from './http-board-store';
import type { BoardSnapshot } from './sent-write';
import type { BoardListLoad, WorkspaceStore } from './workspace-store';

export interface HttpWorkspaceStoreParams {
  readonly api: BoardsApi;
  /** Conteúdo do quadro padrão, criado quando o servidor não tem nenhum quadro. */
  readonly defaultContent: () => Board;
  /** Espera entre a mudança de um quadro e o envio, em milissegundos. */
  readonly writeDelayMs?: number;
}

interface OpenBoardParams {
  readonly boardId: string;
  /** Quadro novo, que o servidor ainda não tem. */
  readonly created?: BoardSnapshot;
}

/** Os quadros gravados na API: a lista vem de `GET /boards`, e cada quadro é um documento inteiro, com o nome dentro. */
export function createHttpWorkspaceStore(
  params: HttpWorkspaceStoreParams,
): WorkspaceStore {
  const { api, writeDelayMs } = params;
  const boardStores = new Map<string, HttpBoardStore>();
  /** Exclusões que o servidor ainda não respondeu. */
  let removing = 0;

  const open = (target: OpenBoardParams): HttpBoardStore => {
    const { boardId, created } = target;
    const existing = boardStores.get(boardId);
    if (existing) {
      return existing;
    }
    const store = createHttpBoardStore({ api, boardId, created, writeDelayMs });
    boardStores.set(boardId, store);
    return store;
  };

  const hasUnsaved = (): boolean => {
    for (const store of boardStores.values()) {
      if (store.hasUnsaved()) {
        return true;
      }
    }
    return false;
  };

  const readList = async (): Promise<BoardListLoad> => {
    const result = await api.list();
    if (!result.ok) {
      return { kind: 'failed', message: result.error.message };
    }
    const boards = result.value.map(({ id, name }) => ({ id, name }));
    return { kind: 'found', boards };
  };

  return {
    async loadList() {
      const list = await readList();
      if (list.kind === 'failed' || list.boards.length > 0) {
        return list;
      }
      // NOTE: servidor sem nenhum quadro: o painel cria o quadro padrão. Pedir a lista de novo antes de a criação
      // chegar ao servidor não cria outro, porque o quadro já está aberto aqui.
      open({
        boardId: DEFAULT_BOARD.id,
        created: { name: DEFAULT_BOARD.name, board: params.defaultContent() },
      });
      return { kind: 'found', boards: DEFAULT_BOARDS };
    },
    create({ board, content }) {
      open({
        boardId: board.id,
        created: { name: board.name, board: content },
      });
    },
    rename({ boardId, name }) {
      open({ boardId }).rename(name);
    },
    async remove({ boardId }) {
      const store = boardStores.get(boardId);
      boardStores.delete(boardId);
      removing += 1;
      await store?.discard();
      const result = await api.remove(boardId);
      removing -= 1;
      // NOTE: o quadro que já não está no servidor está excluído: repetir a exclusão dá o mesmo resultado.
      if (result.ok || result.error.kind === 'not-found') {
        return null;
      }
      return result.error.message;
    },
    board: (boardId) => open({ boardId }),
    remote: {
      async refreshList() {
        // NOTE: a lista do servidor ainda não mostra o quadro por criar, e ainda mostra o que está sendo excluído.
        if (hasUnsaved() || removing > 0) {
          return null;
        }
        const list = await readList();
        return list.kind === 'found' && list.boards.length > 0
          ? list.boards
          : null;
      },
    },
  };
}

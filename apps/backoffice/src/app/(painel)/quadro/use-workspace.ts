import { removeStorage, writeStorage } from './browser-storage';
import type { BoardLane } from './model/board';
import { createBoard } from './model/board-state';
import { nextId } from './model/ids';
import { serializeBoard } from './model/storage';
import {
  addBoard,
  type BoardSummary,
  boardStorageKey,
  neighborBoard,
  removeBoard,
  renameBoard,
} from './model/workspace';
import { boardViewKey } from './use-board-view';
import { collapsedLanesKey } from './use-collapsed-lanes';
import { useStoredBoards } from './use-stored-boards';

/** Colunas de um quadro novo. */
export const NEW_BOARD_LANES: readonly BoardLane[] = [
  { id: 'lane-1', title: 'A fazer', cards: [] },
  { id: 'lane-2', title: 'Em andamento', cards: [] },
  { id: 'lane-3', title: 'Concluído', cards: [] },
];

export interface NewBoard {
  readonly name: string;
  readonly keyPrefix: string;
}

export interface BoardRename {
  readonly boardId: string;
  readonly name: string;
}

export interface WorkspaceCommands {
  /** Cria o quadro e o abre; devolve o id, ou `undefined` quando o nome veio vazio ou repetido. */
  readonly create: (board: NewBoard) => string | undefined;
  readonly rename: (change: BoardRename) => void;
  /** Tira o quadro da lista e apaga o que estava gravado nele; o último quadro não sai. */
  readonly remove: (boardId: string) => void;
  readonly select: (boardId: string) => void;
}

export interface WorkspaceState {
  readonly boards: readonly BoardSummary[];
  readonly activeId: string;
  /** A lista gravada já foi lida. */
  readonly loaded: boolean;
  readonly commands: WorkspaceCommands;
}

export interface UseWorkspaceParams {
  /** Id do quadro pedido no endereço, lido depois de montar. */
  readonly readRequestedId: () => string | null;
}

interface StoreNewBoardParams {
  readonly boardId: string;
  readonly keyPrefix: string;
}

/** Grava o quadro novo já com o prefixo escolhido, para ele abrir com a configuração certa. */
function storeNewBoard(params: StoreNewBoardParams): void {
  const board = createBoard({
    lanes: NEW_BOARD_LANES,
    config: { keyPrefix: params.keyPrefix },
  });
  writeStorage({
    key: boardStorageKey(params.boardId),
    value: serializeBoard(board),
  });
}

/** Apaga tudo o que o quadro gravou no navegador: o conteúdo e as preferências de tela. */
function eraseStoredBoard(boardId: string): void {
  const key = boardStorageKey(boardId);
  removeStorage(key);
  removeStorage(collapsedLanesKey(key));
  removeStorage(boardViewKey(key));
}

/** Lista de quadros, o quadro aberto e os comandos de criar, renomear, excluir e escolher quadro. */
export function useWorkspace(params: UseWorkspaceParams): WorkspaceState {
  const { boards, activeId, loaded, setBoards, setActiveId } =
    useStoredBoards(params);

  function create(board: NewBoard): string | undefined {
    const id = nextId({
      prefix: 'board',
      taken: boards.map((existing) => existing.id),
    });
    const next = addBoard({ boards, board: { id, name: board.name } });
    if (next === boards) {
      return undefined;
    }
    storeNewBoard({ boardId: id, keyPrefix: board.keyPrefix });
    setBoards(next);
    setActiveId(id);
    return id;
  }

  function remove(boardId: string) {
    const next = removeBoard({ boards, boardId });
    if (next === boards) {
      return;
    }
    eraseStoredBoard(boardId);
    setBoards(next);
    // NOTE: se o quadro excluído era o aberto, o vizinho dele passa a ser o aberto.
    const stillOpen = neighborBoard({
      before: boards,
      after: next,
      boardId: activeId,
    });
    setActiveId(stillOpen ?? activeId);
  }

  function select(boardId: string) {
    const exists = boards.some((board) => board.id === boardId);
    if (exists) {
      setActiveId(boardId);
    }
  }

  return {
    boards,
    activeId,
    loaded,
    commands: {
      create,
      rename: (change) => setBoards(renameBoard({ boards, ...change })),
      remove,
      select,
    },
  };
}

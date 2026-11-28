import { useState } from 'react';

import { removeStorage } from './browser-storage';
import type { BoardLane } from './model/board';
import { createBoard } from './model/board-state';
import { nextId } from './model/ids';
import {
  addBoard,
  boardStorageKey,
  neighborBoard,
  removeBoard,
  renameBoard,
  type WorkspaceBoard,
} from './model/workspace';
import { type LoadPhase, READY } from './store/load-phase';
import type { WorkspaceStore } from './store/workspace-store';
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
  readonly boards: readonly WorkspaceBoard[];
  readonly activeId: string;
  /** A lista gravada já foi lida. */
  readonly loaded: boolean;
  /**
   * O que a tela mostra no lugar dos quadros. Só a lista que vem de um servidor passa por `loading` e `failed`: a do
   * navegador é lida na hora, e a tela mostra o quadro principal enquanto isso.
   */
  readonly phase: LoadPhase;
  readonly retryLoad: () => void;
  /** Mudança na lista que o armazenamento recusou, em uma frase para a tela. */
  readonly failure: string | null;
  readonly dismissFailure: () => void;
  readonly commands: WorkspaceCommands;
}

export interface UseWorkspaceParams {
  /** Onde a lista e os quadros são lidos e gravados. */
  readonly store: WorkspaceStore;
  /** Id do quadro pedido no endereço, lido depois de montar. */
  readonly readRequestedId: () => string | null;
}

/** Apaga as preferências de tela do quadro, que ficam sempre no navegador. */
function eraseBoardPreferences(boardId: string): void {
  const key = boardStorageKey(boardId);
  removeStorage(collapsedLanesKey(key));
  removeStorage(boardViewKey(key));
}

interface RestoredBoardParams {
  readonly boards: readonly WorkspaceBoard[];
  readonly board: WorkspaceBoard;
  /** Posição que o quadro tinha na lista. */
  readonly index: number;
}

/** A lista com o quadro de volta ao lugar dele, depois de uma exclusão que não deu certo. */
function withRestoredBoard(
  params: RestoredBoardParams,
): readonly WorkspaceBoard[] {
  const { boards, board, index } = params;
  return [...boards.slice(0, index), board, ...boards.slice(index)];
}

/** Lista de quadros, o quadro aberto e os comandos de criar, renomear, excluir e escolher quadro. */
export function useWorkspace(params: UseWorkspaceParams): WorkspaceState {
  const { store } = params;
  const { boards, activeId, loaded, phase, retry, updateBoards, setActiveId } =
    useStoredBoards(params);
  const [failure, setFailure] = useState<string | null>(null);

  function create(board: NewBoard): string | undefined {
    const id = nextId({
      prefix: 'board',
      taken: boards.map((existing) => existing.id),
    });
    const next = addBoard({ boards, board: { id, name: board.name } });
    const added = next.at(-1);
    if (next === boards || !added) {
      return undefined;
    }
    // NOTE: o quadro novo já é gravado com o prefixo escolhido, para abrir com a configuração certa.
    const content = createBoard({
      lanes: NEW_BOARD_LANES,
      config: { keyPrefix: board.keyPrefix },
    });
    store.create({ boards: next, board: added, content });
    updateBoards(() => next);
    setActiveId(id);
    return id;
  }

  function rename(change: BoardRename) {
    const next = renameBoard({ boards, ...change });
    const renamed = next.find((board) => board.id === change.boardId);
    if (next === boards || !renamed) {
      return;
    }
    store.rename({ boards: next, boardId: renamed.id, name: renamed.name });
    updateBoards(() => next);
  }

  function remove(boardId: string) {
    const next = removeBoard({ boards, boardId });
    const index = boards.findIndex((board) => board.id === boardId);
    const removed = boards[index];
    if (next === boards || !removed) {
      return;
    }
    eraseBoardPreferences(boardId);
    updateBoards(() => next);
    // NOTE: se o quadro excluído era o aberto, o vizinho dele passa a ser o aberto.
    const stillOpen = neighborBoard({
      before: boards,
      after: next,
      boardId: activeId,
    });
    setActiveId(stillOpen ?? activeId);
    void store.remove({ boards: next, boardId }).then((reason) => {
      if (reason === null) {
        return;
      }
      // WHY: o quadro continua no armazenamento; fora da lista, ele só voltaria a aparecer na próxima leitura.
      updateBoards((current) =>
        withRestoredBoard({ boards: current, board: removed, index }),
      );
      setFailure(
        `Não foi possível excluir o quadro ${removed.name}. ${reason}`,
      );
    });
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
    phase: store.remote ? phase : READY,
    retryLoad: retry,
    failure,
    dismissFailure: () => setFailure(null),
    commands: { create, rename, remove, select },
  };
}

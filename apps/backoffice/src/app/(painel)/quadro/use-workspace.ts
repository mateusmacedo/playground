import { useEffect, useRef, useState } from 'react';

import {
  readStorage,
  removeStorage,
  subscribeStorage,
  writeStorage,
} from './browser-storage';
import type { BoardLane } from './model/board';
import { createBoard } from './model/board-state';
import { nextId } from './model/ids';
import { serializeBoard } from './model/storage';
import {
  ACTIVE_BOARD_STORAGE_KEY,
  addBoard,
  BOARDS_STORAGE_KEY,
  type BoardSummary,
  boardStorageKey,
  DEFAULT_BOARD_ID,
  DEFAULT_BOARDS,
  neighborBoard,
  parseStoredBoards,
  removeBoard,
  renameBoard,
  serializeBoards,
} from './model/workspace';
import { collapsedLanesKey } from './use-collapsed-lanes';

/** Colunas de um quadro novo. */
export const NEW_BOARD_LANES: readonly BoardLane[] = [
  { id: 'lane-1', title: 'A fazer', cards: [] },
  { id: 'lane-2', title: 'Em andamento', cards: [] },
  { id: 'lane-3', title: 'Concluído', cards: [] },
];

export interface WorkspaceCommands {
  /** Cria o quadro e o abre; devolve o id, ou `undefined` quando o nome veio vazio ou repetido. */
  readonly create: (board: {
    readonly name: string;
    readonly keyPrefix: string;
  }) => string | undefined;
  readonly rename: (change: {
    readonly boardId: string;
    readonly name: string;
  }) => void;
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

/**
 * Lista de quadros e o quadro aberto. A lista fica gravada e acompanha o que as outras abas mudam; o quadro aberto é
 * desta aba, e o endereço (`?quadro=<id>`) tem prioridade sobre o último aberto.
 */
export function useWorkspace(params: {
  /** Id do quadro pedido no endereço, lido depois de montar. */
  readonly readRequestedId: () => string | null;
}): WorkspaceState {
  const [boards, setBoards] = useState(DEFAULT_BOARDS);
  const [activeId, setActiveId] = useState(DEFAULT_BOARD_ID);
  const [loaded, setLoaded] = useState(false);
  const fromStorage = useRef<readonly BoardSummary[] | null>(null);
  const current = useRef(boards);
  const readRequested = useRef(params.readRequestedId);

  useEffect(() => {
    current.current = boards;
  });

  useEffect(() => {
    const stored = parseStoredBoards(readStorage(BOARDS_STORAGE_KEY));
    const list = stored ?? DEFAULT_BOARDS;
    if (stored) {
      fromStorage.current = stored;
      setBoards(stored);
    }
    const wanted = [
      readRequested.current(),
      readStorage(ACTIVE_BOARD_STORAGE_KEY),
    ].find((id) => list.some((board) => board.id === id));
    setActiveId(wanted ?? list[0]?.id ?? DEFAULT_BOARD_ID);
    setLoaded(true);
    return subscribeStorage({
      key: BOARDS_STORAGE_KEY,
      onChange: (raw) => {
        const received = parseStoredBoards(raw);
        if (!received) {
          return;
        }
        const before = current.current;
        fromStorage.current = received;
        setBoards(received);
        setActiveId(
          (active) =>
            neighborBoard({ before, after: received, boardId: active }) ??
            active,
        );
      },
    });
  }, []);

  useEffect(() => {
    if (loaded && boards !== fromStorage.current) {
      writeStorage({ key: BOARDS_STORAGE_KEY, value: serializeBoards(boards) });
    }
  }, [loaded, boards]);

  useEffect(() => {
    if (loaded) {
      writeStorage({ key: ACTIVE_BOARD_STORAGE_KEY, value: activeId });
    }
  }, [loaded, activeId]);

  const commands: WorkspaceCommands = {
    create: ({ name, keyPrefix }) => {
      const id = nextId({
        prefix: 'board',
        taken: boards.map((board) => board.id),
      });
      const next = addBoard({ boards, board: { id, name } });
      if (next === boards) {
        return undefined;
      }
      // NOTE: o quadro nasce gravado, com o prefixo escolhido, antes de abrir.
      writeStorage({
        key: boardStorageKey(id),
        value: serializeBoard(
          createBoard({ lanes: NEW_BOARD_LANES, config: { keyPrefix } }),
        ),
      });
      setBoards(next);
      setActiveId(id);
      return id;
    },
    rename: (change) => setBoards(renameBoard({ boards, ...change })),
    remove: (boardId) => {
      const next = removeBoard({ boards, boardId });
      if (next === boards) {
        return;
      }
      removeStorage(boardStorageKey(boardId));
      removeStorage(collapsedLanesKey(boardStorageKey(boardId)));
      setBoards(next);
      setActiveId(
        (active) =>
          neighborBoard({ before: boards, after: next, boardId: active }) ??
          active,
      );
    },
    select: (boardId) => {
      if (boards.some((board) => board.id === boardId)) {
        setActiveId(boardId);
      }
    },
  };

  return { boards, activeId, loaded, commands };
}

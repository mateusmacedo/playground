import { useEffect, useRef, useState } from 'react';

import { readStorage, subscribeStorage, writeStorage } from './browser-storage';
import {
  ACTIVE_BOARD_STORAGE_KEY,
  BOARDS_STORAGE_KEY,
  type BoardSummary,
  DEFAULT_BOARD_ID,
  DEFAULT_BOARDS,
  neighborBoard,
  parseStoredBoards,
  serializeBoards,
} from './model/workspace';

interface FirstKnownBoardParams {
  /** Ids pedidos, do mais prioritário para o menos; `null` é um pedido que não existe. */
  readonly ids: readonly (string | null)[];
  readonly boards: readonly BoardSummary[];
}

/** Primeiro id pedido que é de um quadro da lista. */
function firstKnownBoard(params: FirstKnownBoardParams): string | undefined {
  for (const id of params.ids) {
    const known = params.boards.some((board) => board.id === id);
    if (id !== null && known) {
      return id;
    }
  }
  return undefined;
}

export interface UseStoredBoardsParams {
  /** Id do quadro pedido no endereço, lido depois de montar. */
  readonly readRequestedId: () => string | null;
}

export interface StoredBoards {
  readonly boards: readonly BoardSummary[];
  readonly activeId: string;
  /** A lista gravada já foi lida. */
  readonly loaded: boolean;
  readonly setBoards: (boards: readonly BoardSummary[]) => void;
  readonly setActiveId: (boardId: string) => void;
}

/**
 * Lista de quadros e quadro aberto, gravados no navegador. A lista acompanha o que as outras abas mudam; o quadro
 * aberto é desta aba, e o endereço (`?quadro=<id>`) tem prioridade sobre o último aberto.
 */
export function useStoredBoards(params: UseStoredBoardsParams): StoredBoards {
  const [boards, setBoards] = useState(DEFAULT_BOARDS);
  const [activeId, setActiveId] = useState(DEFAULT_BOARD_ID);
  const [loaded, setLoaded] = useState(false);
  /** Última lista lida do navegador, que não precisa ser gravada de volta. */
  const fromStorage = useRef<readonly BoardSummary[] | null>(null);
  const latestBoards = useRef(boards);
  const readRequested = useRef(params.readRequestedId);

  useEffect(() => {
    latestBoards.current = boards;
  });

  useEffect(() => {
    const stored = parseStoredBoards(readStorage(BOARDS_STORAGE_KEY));
    const list = stored ?? DEFAULT_BOARDS;
    if (stored) {
      fromStorage.current = stored;
      setBoards(stored);
    }
    const requested = firstKnownBoard({
      ids: [readRequested.current(), readStorage(ACTIVE_BOARD_STORAGE_KEY)],
      boards: list,
    });
    setActiveId(requested ?? list[0]?.id ?? DEFAULT_BOARD_ID);
    setLoaded(true);

    return subscribeStorage({
      key: BOARDS_STORAGE_KEY,
      onChange: (raw) => {
        const received = parseStoredBoards(raw);
        if (!received) {
          return;
        }
        const before = latestBoards.current;
        fromStorage.current = received;
        setBoards(received);
        // NOTE: se outra aba excluiu o quadro aberto aqui, esta aba passa para o vizinho dele.
        setActiveId((active) => {
          const stillOpen = neighborBoard({
            before,
            after: received,
            boardId: active,
          });
          return stillOpen ?? active;
        });
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

  return { boards, activeId, loaded, setBoards, setActiveId };
}

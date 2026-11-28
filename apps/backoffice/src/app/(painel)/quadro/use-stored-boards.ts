import { useEffect, useEffectEvent, useState } from 'react';

import { useReloadOnFocus } from '@/shared/hooks/use-reload-on-focus';

import { readStorage, writeStorage } from './browser-storage';
import {
  ACTIVE_BOARD_STORAGE_KEY,
  DEFAULT_BOARD_ID,
  DEFAULT_BOARDS,
  neighborBoard,
  type WorkspaceBoard,
} from './model/workspace';
import {
  failedPhase,
  LOADING,
  type LoadPhase,
  READY,
} from './store/load-phase';
import type { BoardListLoad, WorkspaceStore } from './store/workspace-store';

interface FirstKnownBoardParams {
  /** Ids pedidos, do mais prioritário para o menos; `null` é um pedido que não existe. */
  readonly ids: readonly (string | null)[];
  readonly boards: readonly WorkspaceBoard[];
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

/** A lista de quadros e o quadro aberto, que mudam juntos quando o aberto sai da lista. */
interface OpenBoards {
  readonly boards: readonly WorkspaceBoard[];
  readonly activeId: string;
}

interface WithReceivedListParams {
  readonly current: OpenBoards;
  /** Lista que chegou de fora: de outra aba ou do servidor. */
  readonly received: readonly WorkspaceBoard[];
}

function withReceivedList(params: WithReceivedListParams): OpenBoards {
  const { current, received } = params;
  // NOTE: se o quadro aberto aqui foi excluído em outro lugar, a tela passa para o vizinho dele.
  const stillOpen = neighborBoard({
    before: current.boards,
    after: received,
    boardId: current.activeId,
  });
  return { boards: received, activeId: stillOpen ?? current.activeId };
}

export type BoardsUpdate = (
  boards: readonly WorkspaceBoard[],
) => readonly WorkspaceBoard[];

export interface UseStoredBoardsParams {
  /** Onde a lista é lida. */
  readonly store: WorkspaceStore;
  /** Id do quadro pedido no endereço, lido depois de montar. */
  readonly readRequestedId: () => string | null;
}

export interface StoredBoards {
  readonly boards: readonly WorkspaceBoard[];
  readonly activeId: string;
  /** A lista gravada já foi lida. */
  readonly loaded: boolean;
  /** A leitura da lista: em andamento, pronta, ou falhou com o motivo. */
  readonly phase: LoadPhase;
  /** Lê a lista de novo, depois de uma falha. */
  readonly retry: () => void;
  readonly updateBoards: (update: BoardsUpdate) => void;
  readonly setActiveId: (boardId: string) => void;
}

/**
 * Lista de quadros, lida do armazenamento, e o quadro aberto. A lista acompanha o que muda fora desta tela: as outras
 * abas, no navegador, e o servidor, a cada volta para a aba. O quadro aberto é desta aba e fica no navegador; o
 * endereço (`?quadro=<id>`) tem prioridade sobre o último aberto.
 */
export function useStoredBoards(params: UseStoredBoardsParams): StoredBoards {
  const { store } = params;
  const [open, setOpen] = useState<OpenBoards>({
    boards: DEFAULT_BOARDS,
    activeId: DEFAULT_BOARD_ID,
  });
  const [phase, setPhase] = useState(LOADING);
  const loaded = phase.kind === 'ready';
  const loading = phase.kind === 'loading';
  const { activeId } = open;

  const start = useEffectEvent((list: BoardListLoad) => {
    if (list.kind === 'failed') {
      setPhase(failedPhase(list.message));
      return;
    }
    const { boards } = list;
    const requested = firstKnownBoard({
      ids: [params.readRequestedId(), readStorage(ACTIVE_BOARD_STORAGE_KEY)],
      boards,
    });
    setOpen({
      boards,
      activeId: requested ?? boards[0]?.id ?? DEFAULT_BOARD_ID,
    });
    setPhase(READY);
  });

  useEffect(() => {
    if (!loading) {
      return;
    }
    let current = true;
    void store.loadList().then((list) => {
      if (current) {
        start(list);
      }
    });
    return () => {
      current = false;
    };
  }, [store, loading]);

  useEffect(() => {
    return store.watchList?.((received) =>
      setOpen((current) => withReceivedList({ current, received })),
    );
  }, [store]);

  useEffect(() => {
    if (loaded) {
      writeStorage({ key: ACTIVE_BOARD_STORAGE_KEY, value: activeId });
    }
  }, [loaded, activeId]);

  const remote = store.remote;
  useReloadOnFocus({
    enabled: remote !== undefined && loaded,
    reload: () => {
      void remote?.refreshList().then((received) => {
        if (received) {
          setOpen((current) => withReceivedList({ current, received }));
        }
      });
    },
  });

  return {
    boards: open.boards,
    activeId,
    loaded,
    phase,
    retry: () => setPhase(LOADING),
    updateBoards: (update) =>
      setOpen((current) => ({ ...current, boards: update(current.boards) })),
    setActiveId: (boardId) =>
      setOpen((current) => ({ ...current, activeId: boardId })),
  };
}

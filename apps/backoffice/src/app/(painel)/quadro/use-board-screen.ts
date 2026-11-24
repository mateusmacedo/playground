import { type RefObject, useId, useRef } from 'react';

import { useIsClient } from '@/shared/hooks/use-is-client';

import type { BoardCommands } from './board-commands';
import { type LockWarning, lockWarning } from './lock-warning';
import type { Board, BoardLane } from './model/board';
import { cardKey } from './model/card-key';
import { todayIso } from './model/due';
import { visibleLanes } from './model/lane-state';
import { type UseBoardParams, useBoard } from './use-board';
import { type BoardFeedback, useBoardFeedback } from './use-board-feedback';
import { type BoardFilter, useBoardFilter } from './use-board-filter';
import { type BoardFocus, useBoardFocus } from './use-board-focus';
import { type BoardMoves, useBoardMoves } from './use-board-moves';
import { useBoardShortcuts } from './use-board-shortcuts';
import { type BoardView, useBoardView } from './use-board-view';
import { type BoardWindows, useBoardWindows } from './use-board-windows';
import { useCardUrl } from './use-card-url';
import { type CollapsedLanes, useCollapsedLanes } from './use-collapsed-lanes';
import { type HistoryActions, useHistoryActions } from './use-history-actions';
import { type ListSortState, useListSort } from './use-list-sort';

/** Tudo o que a tela do quadro tem: o quadro, os comandos e o estado de cada parte da tela. */
export interface BoardScreen {
  readonly board: Board;
  /** As colunas que estão na tela, sem as ocultas. */
  readonly shown: readonly BoardLane[];
  readonly commands: BoardCommands;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** A última gravação falhou, quase sempre por falta de espaço no navegador. */
  readonly storageFull: boolean;
  readonly feedback: BoardFeedback;
  readonly focus: BoardFocus;
  readonly filter: BoardFilter;
  readonly view: BoardView;
  readonly setView: (change: Partial<BoardView>) => void;
  readonly listSort: ListSortState;
  readonly collapsedLanes: CollapsedLanes;
  readonly blockedByLock: LockWarning;
  readonly moves: BoardMoves;
  readonly windows: BoardWindows;
  readonly history: HistoryActions;
  readonly searchRef: RefObject<HTMLInputElement | null>;
  /** Id do texto com as instruções de uso, que as alças de mover citam. */
  readonly instructionsId: string;
  /** A página já montou no navegador; antes disso não há relógio nem área de transferência. */
  readonly isClient: boolean;
  /** Hoje (`AAAA-MM-DD`), só depois de montar no navegador. */
  readonly today: string | undefined;
}

/** Monta o estado da tela do quadro, ligando cada parte às que ela precisa. */
export function useBoardScreen(params: UseBoardParams): BoardScreen {
  const { board, canUndo, canRedo, loaded, storageFull, commands } =
    useBoard(params);
  const { lanes } = board;
  const { keyPrefix } = board.config;
  const shown = visibleLanes(lanes);
  const isClient = useIsClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const instructionsId = useId();

  const feedback = useBoardFeedback();
  const focus = useBoardFocus();
  const filter = useBoardFilter({ labels: board.labels, keyPrefix });
  const { view, setView } = useBoardView(params.storageKey);
  const listSort = useListSort();
  const collapsedLanes = useCollapsedLanes(params.storageKey);
  const blockedByLock = lockWarning({ lanes, notify: feedback.notify });

  const moves = useBoardMoves({
    lanes,
    shown,
    collapsedLanes,
    commands,
    announce: feedback.announce,
    blockedByLock,
  });
  const windows = useBoardWindows({
    board,
    commands,
    feedback,
    focus,
    blockedByLock,
  });
  const history = useHistoryActions({
    canUndo,
    canRedo,
    commands,
    releaseKeyboard: moves.keyboard.release,
    announce: feedback.announce,
    focus,
  });

  useBoardShortcuts({
    onUndo: history.undo,
    onRedo: history.redo,
    onFocusSearch: () => searchRef.current?.focus(),
  });

  const { panel, archiveView } = windows;
  const shownCard = panel.visible ? panel.location?.card : undefined;
  useCardUrl({
    ready: loaded,
    board,
    openKey: shownCard
      ? cardKey({ card: shownCard, prefix: keyPrefix })
      : undefined,
    onOpen: panel.open,
    onOpenArchived: archiveView.showCard,
    onUnavailable: (text) => feedback.notify({ color: 'warning', text }),
  });

  return {
    board,
    shown,
    commands,
    canUndo,
    canRedo,
    storageFull,
    feedback,
    focus,
    filter,
    view,
    setView,
    listSort,
    collapsedLanes,
    blockedByLock,
    moves,
    windows,
    history,
    searchRef,
    instructionsId,
    isClient,
    today: isClient ? todayIso() : undefined,
  };
}

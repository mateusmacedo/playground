import type { BoardCommands } from './board-commands';
import type { Announce } from './board-notices';
import type { LockWarning } from './lock-warning';
import type { BoardLane } from './model/board';
import { type ArchiveDrop, useArchiveDrop } from './use-archive-drop';
import { type BoardDrags, useBoardDrags } from './use-board-drags';
import type { CollapsedLanes } from './use-collapsed-lanes';
import { type KeyboardMoves, useKeyboardMoves } from './use-keyboard-moves';
import { type SwimlaneDrop, useSwimlaneDrop } from './use-swimlane-drop';

export interface UseBoardMovesParams {
  /** Todas as colunas do quadro, inclusive as ocultas. */
  readonly lanes: readonly BoardLane[];
  /** As colunas que estão na tela. */
  readonly shown: readonly BoardLane[];
  readonly collapsedLanes: CollapsedLanes;
  readonly commands: BoardCommands;
  readonly announce: Announce;
  readonly blockedByLock: LockWarning;
}

/** Todas as formas de mover cards e colunas no quadro. */
export interface BoardMoves {
  readonly keyboard: KeyboardMoves;
  readonly drags: BoardDrags;
  /** Soltar um card na coluna de arquivados. */
  readonly archiveDrop: ArchiveDrop;
  /** Soltar um card numa célula das linhas por card pai. */
  readonly swimlaneDrop: SwimlaneDrop;
}

export function useBoardMoves(params: UseBoardMovesParams): BoardMoves {
  const { lanes, shown, collapsedLanes, commands, announce, blockedByLock } =
    params;

  const keyboard = useKeyboardMoves({
    lanes,
    shown,
    collapsedLanes,
    commands,
    announce,
  });
  const drags = useBoardDrags({
    lanes,
    shown,
    commands,
    announce,
    onDragStart: keyboard.release,
  });
  const archiveDrop = useArchiveDrop({
    lanes,
    drag: drags.card,
    archiveCard: commands.archiveCard,
    announce,
  });
  const swimlaneDrop = useSwimlaneDrop({
    lanes,
    drag: drags.card,
    blockedByLock,
    moveCardToLane: commands.moveCardToLane,
    announce,
  });

  return { keyboard, drags, archiveDrop, swimlaneDrop };
}

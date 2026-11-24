import type { BoardCommands } from './board-commands';
import type { Announce } from './board-notices';
import type { LaneHeaderActions } from './kanban-lane-header';
import type { BoardLane } from './model/board';
import type { BoardDialogsState } from './use-board-dialogs';
import type { BoardFocus } from './use-board-focus';
import type { CollapsedLanes } from './use-collapsed-lanes';
import type { KeyboardMoves } from './use-keyboard-moves';
import type { LaneDrag } from './use-lane-drag';

export interface LaneHeaderActionsParams {
  /** Todas as colunas do quadro, inclusive as ocultas. */
  readonly lanes: readonly BoardLane[];
  /** As colunas que estão na tela. */
  readonly shown: readonly BoardLane[];
  readonly commands: Pick<
    BoardCommands,
    'renameLane' | 'setLaneHidden' | 'setLaneLocked'
  >;
  readonly collapsedLanes: CollapsedLanes;
  readonly keyboard: KeyboardMoves;
  readonly drag: LaneDrag;
  readonly dialogs: Pick<
    BoardDialogsState,
    'requestLimit' | 'requestLaneRemoval'
  >;
  readonly announce: Announce;
  readonly focus: Pick<BoardFocus, 'focusLaneLater'>;
}

/** O que o cabeçalho de cada coluna pede ao quadro: mover, renomear, limitar, ocultar, bloquear, recolher e excluir. */
export function laneHeaderActions(
  params: LaneHeaderActionsParams,
): LaneHeaderActions {
  const { lanes, shown, commands, collapsedLanes, keyboard, drag, dialogs } =
    params;
  const { announce, focus } = params;

  function titleOf(laneId: string): string | undefined {
    return lanes.find((lane) => lane.id === laneId)?.title;
  }

  function hide(laneId: string) {
    const index = shown.findIndex((lane) => lane.id === laneId);
    const neighbor = shown[index + 1] ?? shown[index - 1];
    commands.setLaneHidden({ laneId, hidden: true });
    announce(`Coluna ${titleOf(laneId)} oculta.`);
    focus.focusLaneLater(neighbor?.id);
  }

  function toggleLock(laneId: string) {
    const lane = lanes.find((candidate) => candidate.id === laneId);
    const wasLocked = Boolean(lane?.locked);
    commands.setLaneLocked({ laneId, locked: !wasLocked });
    announce(`Coluna ${lane?.title} ${wasLocked ? 'liberada' : 'bloqueada'}.`);
    focus.focusLaneLater(laneId);
  }

  function toggleCollapse(laneId: string) {
    const wasCollapsed = collapsedLanes.collapsed.has(laneId);
    collapsedLanes.toggle(laneId);
    announce(
      `Coluna ${titleOf(laneId)} ${wasCollapsed ? 'expandida' : 'recolhida'}.`,
    );
    focus.focusLaneLater(laneId);
  }

  return {
    onHandleDragStart: drag.onDragStart,
    onHandleDragEnd: drag.onDragEnd,
    onHandleClick: keyboard.onLaneHandleClick,
    onHandleKeyDown: keyboard.lane.onHandleKeyDown,
    onHandleBlur: keyboard.lane.onHandleBlur,
    registerHandle: keyboard.lane.registerHandle,
    onRename: commands.renameLane,
    onRequestLimit: dialogs.requestLimit,
    onRequestRemove: dialogs.requestLaneRemoval,
    onHide: hide,
    onToggleLock: toggleLock,
    onToggleCollapse: toggleCollapse,
  };
}

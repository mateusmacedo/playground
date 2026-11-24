import type { BoardCommands } from './board-commands';
import type { Announce } from './board-notices';
import { announcementText, laneAnnouncementText } from './model/announcements';
import type { BoardLane } from './model/board';
import { brokenLock, mergeVisible } from './model/lane-state';
import { type DragAndDrop, useDragAndDrop } from './use-drag-and-drop';
import { type LaneDrag, useLaneDrag } from './use-lane-drag';

export interface UseBoardDragsParams {
  /** Todas as colunas do quadro, inclusive as ocultas. */
  readonly lanes: readonly BoardLane[];
  /** As colunas que estão na tela. */
  readonly shown: readonly BoardLane[];
  readonly commands: Pick<BoardCommands, 'setLanes'>;
  readonly announce: Announce;
  /** O arraste começou: quem estava pego pelo teclado é solto. */
  readonly onDragStart: () => void;
}

export interface BoardDrags {
  readonly card: DragAndDrop;
  readonly lane: LaneDrag;
}

/** Arraste de cards e de colunas, gravado no quadro com as colunas ocultas nos lugares delas. */
export function useBoardDrags(params: UseBoardDragsParams): BoardDrags {
  const { lanes, shown, commands, announce, onDragStart } = params;

  const card = useDragAndDrop({
    lanes: shown,
    onDragStart,
    onDrop: (drop) => {
      const next = mergeVisible({ all: lanes, visible: drop.lanes });
      const locked = brokenLock({ before: lanes, after: next });
      if (locked) {
        announce(`A coluna ${locked.title} está bloqueada.`);
        return;
      }
      commands.setLanes({ lanes: next });
      announce(
        announcementText({
          kind: 'dropped',
          lanes: drop.lanes,
          cardId: drop.cardId,
        }),
      );
    },
  });

  const lane = useLaneDrag({
    lanes: shown,
    onDragStart,
    onDrop: (drop) => {
      commands.setLanes({
        lanes: mergeVisible({ all: lanes, visible: drop.lanes }),
      });
      announce(
        laneAnnouncementText({
          kind: 'dropped',
          lanes: drop.lanes,
          laneId: drop.laneId,
        }),
      );
    },
  });

  return { card, lane };
}

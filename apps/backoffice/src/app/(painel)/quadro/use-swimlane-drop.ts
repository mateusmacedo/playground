import { type DragEvent, useState } from 'react';
import type { BoardCommands } from './board-commands';
import type { Announce } from './board-notices';
import type { LockWarning } from './lock-warning';
import { type BoardLane, findCard } from './model/board';
import { type CellTarget, cellId } from './swimlanes';
import type { DragAndDrop } from './use-drag-and-drop';

export interface UseSwimlaneDropParams {
  readonly lanes: readonly BoardLane[];
  /** O arraste de cards em andamento. */
  readonly drag: Pick<DragAndDrop, 'draggedId' | 'onDragEnd'>;
  readonly blockedByLock: LockWarning;
  readonly moveCardToLane: BoardCommands['moveCardToLane'];
  readonly announce: Announce;
}

export interface SwimlaneDrop {
  /** Célula sob o card arrastado, no formato de `cellId`; `null` fora de um arraste. */
  readonly target: string | null;
  readonly onDragOver: (
    event: DragEvent<HTMLElement>,
    target: CellTarget,
  ) => void;
  readonly onDragLeave: (event: DragEvent<HTMLElement>) => void;
  readonly onDrop: (event: DragEvent<HTMLElement>, target: CellTarget) => void;
}

/** Nas linhas por card pai, soltar o card arrastado numa célula leva o card para o fim daquela coluna. */
export function useSwimlaneDrop(params: UseSwimlaneDropParams): SwimlaneDrop {
  const { lanes, drag, blockedByLock, moveCardToLane, announce } = params;
  const [target, setTarget] = useState<string | null>(null);

  function onDragOver(event: DragEvent<HTMLElement>, cell: CellTarget) {
    if (!drag.draggedId || cell.lane.locked) {
      return;
    }
    event.preventDefault();
    // WHY: o arraste do card só permite `move`; com outro efeito, o Chromium recusa o drop.
    event.dataTransfer.dropEffect = 'move';
    setTarget(cellId(cell));
  }

  function onDragLeave(event: DragEvent<HTMLElement>) {
    const goingTo = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(goingTo)) {
      setTarget(null);
    }
  }

  function onDrop(event: DragEvent<HTMLElement>, cell: CellTarget) {
    setTarget(null);
    const cardId = drag.draggedId;
    if (!cardId) {
      return;
    }
    event.preventDefault();
    drag.onDragEnd();
    const location = findCard({ lanes, cardId });
    if (!location || location.lane.id === cell.lane.id) {
      return;
    }
    if (blockedByLock({ cardId, laneId: cell.lane.id })) {
      return;
    }
    moveCardToLane({ cardId, laneId: cell.lane.id });
    announce(`Card ${location.card.title} movido para ${cell.lane.title}.`);
  }

  return { target, onDragOver, onDragLeave, onDrop };
}

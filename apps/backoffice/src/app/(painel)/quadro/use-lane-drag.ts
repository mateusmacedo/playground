import { type DragEvent, useState } from 'react';

import type { BoardLane } from './model/board';
import { laneSlotToIndex, moveLane } from './model/lanes';

export interface LaneDrag {
  readonly draggedLaneId: string | null;
  /** Fenda com a linha de inserção (antes da coluna nesta posição, ou o fim); nula quando soltar ali não muda nada. */
  readonly visibleSlot: number | null;
  readonly onDragStart: (event: DragEvent<HTMLElement>, laneId: string) => void;
  readonly onDragEnd: () => void;
  readonly onDragOver: (event: DragEvent<HTMLElement>) => void;
  readonly onDragLeave: (event: DragEvent<HTMLElement>) => void;
  readonly onDrop: (event: DragEvent<HTMLElement>) => void;
}

/** Fenda sob o ponteiro: antes da primeira coluna cuja metade fica à direita dele; passando de todas, o fim. */
function slotFromPointer(event: DragEvent<HTMLElement>): number {
  const columns = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[data-lane-index]'),
  );
  const next = columns.find((column) => {
    const rect = column.getBoundingClientRect();
    return event.clientX < rect.left + rect.width / 2;
  });
  return next ? Number(next.dataset.laneIndex) : columns.length;
}

export interface LaneDrop {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
}

interface LaneDropAttempt {
  readonly laneId: string;
  readonly slot: number;
}

export interface UseLaneDragParams {
  readonly lanes: readonly BoardLane[];
  readonly onDragStart: () => void;
  readonly onDrop: (drop: LaneDrop) => void;
}

/**
 * Arraste nativo das colunas pela alça do cabeçalho. Os eventos ficam no contêiner das colunas e ignoram o arraste de
 * cards, que tem estado próprio no `useDragAndDrop`.
 */
export function useLaneDrag(params: UseLaneDragParams): LaneDrag {
  const { lanes } = params;
  const [draggedLaneId, setDraggedLaneId] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);

  function lanesAfterDrop(drop: LaneDropAttempt) {
    const toIndex = laneSlotToIndex({ lanes, ...drop });
    return moveLane({ lanes, laneId: drop.laneId, toIndex });
  }

  function clearDrag() {
    setDraggedLaneId(null);
    setSlot(null);
  }

  function onDragStart(event: DragEvent<HTMLElement>, laneId: string) {
    // WHY: o Firefox só inicia o arraste com algum dado no `dataTransfer`.
    event.dataTransfer.setData('text/plain', laneId);
    event.dataTransfer.effectAllowed = 'move';
    // NOTE: a alça é pequena; a imagem do arraste é a coluna inteira, para ficar claro o que está se movendo.
    const column = event.currentTarget.closest('section');
    if (column) {
      event.dataTransfer.setDragImage(column, 24, 24);
    }
    setDraggedLaneId(laneId);
    params.onDragStart();
  }

  function onDragOver(event: DragEvent<HTMLElement>) {
    if (!draggedLaneId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const next = slotFromPointer(event);
    setSlot((current) => (current === next ? current : next));
  }

  function onDragLeave(event: DragEvent<HTMLElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setSlot(null);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    if (!draggedLaneId) {
      return;
    }
    event.preventDefault();
    const next = lanesAfterDrop({
      laneId: draggedLaneId,
      slot: slotFromPointer(event),
    });
    if (next !== lanes) {
      params.onDrop({ lanes: next, laneId: draggedLaneId });
    }
    clearDrag();
  }

  const visibleSlot =
    draggedLaneId !== null &&
    slot !== null &&
    lanesAfterDrop({ laneId: draggedLaneId, slot }) !== lanes
      ? slot
      : null;

  return {
    draggedLaneId,
    visibleSlot,
    onDragStart,
    onDragEnd: clearDrag,
    onDragOver,
    onDragLeave,
    onDrop,
  };
}

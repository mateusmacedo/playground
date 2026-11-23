import { type DragEvent, useState } from 'react';

import { type BoardLane, moveCard, slotToIndex } from './board';

export interface DropTarget {
  readonly laneId: string;
  /** Fenda de inserção: antes do card nesta posição, ou o fim da coluna. */
  readonly slot: number;
}

export interface DragAndDrop {
  readonly draggedId: string | null;
  /** Fenda com a linha de inserção; nula quando soltar ali não muda o quadro. */
  readonly visibleDrop: DropTarget | null;
  readonly onDragStart: (event: DragEvent<HTMLElement>, cardId: string) => void;
  readonly onDragEnd: () => void;
  readonly onDragOver: (event: DragEvent<HTMLElement>, lane: BoardLane) => void;
  readonly onDragLeave: (event: DragEvent<HTMLElement>, laneId: string) => void;
  readonly onDrop: (event: DragEvent<HTMLElement>, lane: BoardLane) => void;
}

/** Fenda sob o ponteiro: antes do card na metade de cima dele, depois na metade de baixo; fora de card, o fim. */
function slotFromPointer(
  event: DragEvent<HTMLElement>,
  cardCount: number,
): number {
  const target =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-card-index]')
      : null;
  if (!target) {
    return cardCount;
  }
  const index = Number(target.dataset.cardIndex);
  const rect = target.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? index : index + 1;
}

/** Arraste nativo do HTML5, que cobre mouse e toque; o quadro decide o que fazer com o resultado do drop. */
export function useDragAndDrop(params: {
  readonly lanes: readonly BoardLane[];
  readonly onDragStart: () => void;
  readonly onDrop: (drop: {
    readonly lanes: readonly BoardLane[];
    readonly cardId: string;
  }) => void;
}): DragAndDrop {
  const { lanes } = params;
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  /** Quadro depois de soltar o card na fenda; o próprio `lanes` quando soltar ali não muda nada. */
  function lanesAfterDrop(drop: {
    readonly cardId: string;
    readonly target: DropTarget;
  }) {
    const { cardId, target } = drop;
    const toIndex = slotToIndex({
      lanes,
      cardId,
      laneId: target.laneId,
      slot: target.slot,
    });
    return moveCard({ lanes, cardId, toLaneId: target.laneId, toIndex });
  }

  function clearDrag() {
    setDraggedId(null);
    setDropTarget(null);
  }

  function onDragStart(event: DragEvent<HTMLElement>, cardId: string) {
    // WHY: o Firefox só inicia o arraste com algum dado no `dataTransfer`.
    event.dataTransfer.setData('text/plain', cardId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedId(cardId);
    params.onDragStart();
  }

  function onDragOver(event: DragEvent<HTMLElement>, lane: BoardLane) {
    // NOTE: sem arraste ativo (um arquivo, por exemplo), o evento não é cancelado e o navegador recusa o drop.
    if (!draggedId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const slot = slotFromPointer(event, lane.cards.length);
    setDropTarget((current) =>
      current?.laneId === lane.id && current.slot === slot
        ? current
        : { laneId: lane.id, slot },
    );
  }

  function onDragLeave(event: DragEvent<HTMLElement>, laneId: string) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setDropTarget((current) => (current?.laneId === laneId ? null : current));
  }

  function onDrop(event: DragEvent<HTMLElement>, lane: BoardLane) {
    if (!draggedId) {
      return;
    }
    event.preventDefault();
    const target = {
      laneId: lane.id,
      slot: slotFromPointer(event, lane.cards.length),
    };
    const next = lanesAfterDrop({ cardId: draggedId, target });
    if (next !== lanes) {
      params.onDrop({ lanes: next, cardId: draggedId });
    }
    clearDrag();
  }

  const visibleDrop =
    draggedId &&
    dropTarget &&
    lanesAfterDrop({ cardId: draggedId, target: dropTarget }) !== lanes
      ? dropTarget
      : null;

  return {
    draggedId,
    visibleDrop,
    onDragStart,
    onDragEnd: clearDrag,
    onDragOver,
    onDragLeave,
    onDrop,
  };
}

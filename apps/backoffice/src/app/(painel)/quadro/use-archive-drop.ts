import { type DragEvent, useState } from 'react';

import type { Announce } from './board-notices';
import { type BoardLane, findCard } from './model/board';
import type { DragAndDrop } from './use-drag-and-drop';

export interface UseArchiveDropParams {
  readonly lanes: readonly BoardLane[];
  /** O arraste de cards em andamento. */
  readonly drag: Pick<DragAndDrop, 'draggedId' | 'onDragEnd'>;
  readonly archiveCard: (cardId: string) => void;
  readonly announce: Announce;
}

export interface ArchiveDrop {
  /** Um card arrastado está sobre a coluna de arquivados e será arquivado ao soltar. */
  readonly active: boolean;
  readonly onDragOver: (event: DragEvent<HTMLElement>) => void;
  readonly onDragLeave: (event: DragEvent<HTMLElement>) => void;
  readonly onDrop: (event: DragEvent<HTMLElement>) => void;
}

/** Soltar um card arrastado na coluna de arquivados arquiva o card, a não ser que ele esteja numa coluna bloqueada. */
export function useArchiveDrop(params: UseArchiveDropParams): ArchiveDrop {
  const { lanes, drag, archiveCard, announce } = params;
  const [active, setActive] = useState(false);

  /** Card arrastado que pode ir para o arquivo; `undefined` sem arraste ou com o card numa coluna bloqueada. */
  function archivableCard() {
    if (!drag.draggedId) {
      return undefined;
    }
    const location = findCard({ lanes, cardId: drag.draggedId });
    if (!location || location.lane.locked) {
      return undefined;
    }
    return location.card;
  }

  function onDragOver(event: DragEvent<HTMLElement>) {
    if (!archivableCard()) {
      return;
    }
    event.preventDefault();
    // WHY: o arraste do card só permite `move`; com outro efeito, o Chromium recusa o drop.
    event.dataTransfer.dropEffect = 'move';
    setActive(true);
  }

  function onDragLeave(event: DragEvent<HTMLElement>) {
    const goingTo = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(goingTo)) {
      setActive(false);
    }
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    setActive(false);
    const card = archivableCard();
    if (!card) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    drag.onDragEnd();
    archiveCard(card.id);
    announce(`Card ${card.title} arquivado.`);
  }

  return { active, onDragOver, onDragLeave, onDrop };
}

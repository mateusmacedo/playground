import { cilMove } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import type { DragEvent, KeyboardEvent } from 'react';

import type { BoardCard } from './board';

/** O que o quadro faz quando o card é arrastado ou comandado pelo teclado. */
export interface KanbanCardActions {
  readonly onDragStart: (event: DragEvent<HTMLElement>, cardId: string) => void;
  readonly onDragEnd: () => void;
  readonly onHandleClick: (cardId: string) => void;
  readonly onHandleKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    cardId: string,
  ) => void;
  readonly onHandleBlur: (cardId: string) => void;
  readonly registerHandle: (
    cardId: string,
    element: HTMLButtonElement | null,
  ) => void;
}

export interface KanbanCardProps {
  readonly card: BoardCard;
  readonly index: number;
  /** Card sendo arrastado pelo mouse ou pelo toque. */
  readonly dragging: boolean;
  /** Card pego pelo teclado, esperando as setas. */
  readonly grabbed: boolean;
  /** Mostra a linha de inserção acima do card. */
  readonly dropBefore: boolean;
  readonly instructionsId: string;
  readonly actions: KanbanCardActions;
}

function cardClassName({
  dragging,
  grabbed,
  dropBefore,
}: Pick<KanbanCardProps, 'dragging' | 'grabbed' | 'dropBefore'>): string {
  let className = 'card kanban-card mb-2';
  if (dragging) {
    className += ' kanban-card--dragging';
  }
  if (grabbed) {
    className += ' kanban-card--grabbed';
  }
  if (dropBefore) {
    className += ' kanban-card--drop-before';
  }
  return className;
}

export function KanbanCard({
  card,
  index,
  dragging,
  grabbed,
  dropBefore,
  instructionsId,
  actions,
}: Readonly<KanbanCardProps>) {
  return (
    <li
      className={cardClassName({ dragging, grabbed, dropBefore })}
      draggable
      data-card-index={index}
      onDragStart={(event) => actions.onDragStart(event, card.id)}
      onDragEnd={actions.onDragEnd}
    >
      <div className="card-body d-flex gap-2 align-items-start p-2">
        <button
          type="button"
          className="btn btn-sm btn-ghost-secondary"
          aria-label={`Mover ${card.title}`}
          aria-describedby={instructionsId}
          aria-pressed={grabbed}
          ref={(element) => actions.registerHandle(card.id, element)}
          onClick={() => actions.onHandleClick(card.id)}
          onKeyDown={(event) => actions.onHandleKeyDown(event, card.id)}
          onBlur={() => actions.onHandleBlur(card.id)}
        >
          <CIcon icon={cilMove} aria-hidden="true" />
        </button>
        <div className="flex-grow-1">
          <h3 className="h6 mb-0">{card.title}</h3>
          {card.description ? (
            <p className="small text-body-secondary mb-0 mt-1">
              {card.description}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

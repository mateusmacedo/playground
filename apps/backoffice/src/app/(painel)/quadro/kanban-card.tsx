import { cilMove } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import type { DragEvent, KeyboardEvent } from 'react';

import type { BoardCard } from './model/board';

/** O que o quadro faz quando o card é aberto, arrastado ou comandado pelo teclado. */
export interface KanbanCardActions {
  readonly onOpen: (cardId: string) => void;
  readonly onDragStart: (event: DragEvent<HTMLElement>, cardId: string) => void;
  readonly onDragEnd: () => void;
  readonly onHandleClick: (cardId: string) => void;
  readonly onHandleKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    cardId: string,
  ) => void;
  readonly onHandleBlur: (cardId: string) => void;
  readonly registerHandle: (handle: {
    readonly id: string;
    readonly element: HTMLButtonElement | null;
  }) => void;
}

export interface KanbanCardProps {
  readonly card: BoardCard;
  readonly index: number;
  /** Título do card pai, quando o card tem um. */
  readonly parentTitle?: string;
  readonly childCount: number;
  /** Card aberto no painel de detalhes. */
  readonly open: boolean;
  /** Card sendo arrastado pelo mouse ou pelo toque. */
  readonly dragging: boolean;
  /** Card pego pelo teclado, esperando as setas. */
  readonly grabbed: boolean;
  /** Mostra a linha de inserção acima do card. */
  readonly dropBefore: boolean;
  readonly instructionsId: string;
  readonly actions: KanbanCardActions;
}

function cardClassName(
  state: Pick<KanbanCardProps, 'open' | 'dragging' | 'grabbed' | 'dropBefore'>,
): string {
  const modifiers: readonly [boolean, string][] = [
    [state.open, 'kanban-card--open'],
    [state.dragging, 'kanban-card--dragging'],
    [state.grabbed, 'kanban-card--grabbed'],
    [state.dropBefore, 'kanban-card--drop-before'],
  ];
  return modifiers.reduce(
    (className, [active, modifier]) =>
      active ? `${className} ${modifier}` : className,
    'card kanban-card mb-2',
  );
}

export function KanbanCard({
  card,
  index,
  parentTitle,
  childCount,
  open,
  dragging,
  grabbed,
  dropBefore,
  instructionsId,
  actions,
}: Readonly<KanbanCardProps>) {
  return (
    <li
      className={cardClassName({ open, dragging, grabbed, dropBefore })}
      draggable
      data-card-index={index}
      onDragStart={(event) => actions.onDragStart(event, card.id)}
      onDragEnd={actions.onDragEnd}
    >
      <div className="card-body d-flex gap-2 align-items-start p-2">
        <button
          type="button"
          className="btn btn-sm btn-ghost-secondary kanban-card__handle"
          aria-label={`Mover ${card.title}`}
          aria-describedby={instructionsId}
          aria-pressed={grabbed}
          ref={(element) => actions.registerHandle({ id: card.id, element })}
          onClick={() => actions.onHandleClick(card.id)}
          onKeyDown={(event) => actions.onHandleKeyDown(event, card.id)}
          onBlur={() => actions.onHandleBlur(card.id)}
        >
          <CIcon icon={cilMove} aria-hidden="true" />
        </button>
        <div className="flex-grow-1 min-w-0">
          <h3 className="h6 mb-0">
            {/* NOTE: o `stretched-link` estende o clique ao card inteiro; a alça fica por cima dele no CSS. */}
            <button
              type="button"
              className="btn btn-link p-0 border-0 text-start text-reset text-decoration-none stretched-link kanban-card__open"
              aria-haspopup="dialog"
              data-card-open={card.id}
              onClick={() => actions.onOpen(card.id)}
            >
              {card.title}
            </button>
          </h3>
          {parentTitle ? (
            <p className="small text-body-secondary mb-0 mt-1">
              Filho de {parentTitle}
            </p>
          ) : null}
          {card.description ? (
            <p className="small text-body-secondary mb-0 mt-1 kanban-card__description">
              {card.description}
            </p>
          ) : null}
          {childCount > 0 ? (
            <span className="badge bg-body-secondary text-body border mt-2">
              {childCount} {childCount === 1 ? 'filho' : 'filhos'}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

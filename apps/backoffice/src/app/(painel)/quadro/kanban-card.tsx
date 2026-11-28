import { cilMove } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import type { DragEvent, KeyboardEvent, ReactNode } from 'react';

import { KanbanCardMeta } from './kanban-card-meta';
import type { BoardCard, BoardLabel, BoardLane } from './model/board';
import { cardKey } from './model/card-key';
import type { ChildProgress } from './model/completion';
import type { HandleRegistration } from './use-keyboard-move';

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
  readonly registerHandle: (handle: HandleRegistration) => void;
}

export interface KanbanCardProps {
  readonly card: BoardCard;
  /** Prefixo do código dos cards do quadro. */
  readonly keyPrefix: string;
  readonly index: number;
  /** Título do card pai, quando o card tem um. */
  readonly parentTitle?: string;
  readonly childCount: number;
  /** Descendentes na coluna de conclusão, quando o quadro tem uma. */
  readonly progress?: ChildProgress;
  /** Nome do responsável. */
  readonly assignee?: string;
  /** O card tem bloqueador fora da coluna de conclusão. */
  readonly blocked?: boolean;
  /** Etiquetas do card, na ordem do catálogo. */
  readonly labels: readonly BoardLabel[];
  /** Hoje (`AAAA-MM-DD`), só depois de montar no navegador. */
  readonly today: string | undefined;
  /** Fora da busca ou do filtro: fica esmaecido, mas continua utilizável. */
  readonly dimmed: boolean;
  /** Card aberto no painel de detalhes. */
  readonly open: boolean;
  /** Card sendo arrastado pelo mouse ou pelo toque. */
  readonly dragging: boolean;
  /** Card pego pelo teclado, esperando as setas. */
  readonly grabbed: boolean;
  /** Mostra a linha de inserção acima do card. */
  readonly dropBefore: boolean;
  /** O card está numa coluna bloqueada e não pode ser movido. */
  readonly locked?: boolean;
  readonly instructionsId: string;
  readonly actions: KanbanCardActions;
}

/** Card a desenhar: a coluna e a posição em que ele está, e se a linha de inserção do arraste fica acima dele. */
export interface CardPlacement {
  readonly card: BoardCard;
  readonly lane: BoardLane;
  readonly index: number;
  readonly dropBefore: boolean;
}

/** Desenha o card do quadro; as visões (colunas e linhas por card pai) recebem esta função pronta. */
export type RenderCard = (placement: CardPlacement) => ReactNode;

/** Estados do card que mudam a aparência dele. */
type CardVisualState = Pick<
  KanbanCardProps,
  'open' | 'dragging' | 'grabbed' | 'dropBefore' | 'dimmed'
>;

function cardClassName(state: CardVisualState): string {
  const classes = ['card', 'kanban-card', 'mb-2'];
  if (state.open) {
    classes.push('kanban-card--open');
  }
  if (state.dragging) {
    classes.push('kanban-card--dragging');
  }
  if (state.grabbed) {
    classes.push('kanban-card--grabbed');
  }
  if (state.dropBefore) {
    classes.push('kanban-card--drop-before');
  }
  if (state.dimmed) {
    classes.push('kanban-card--dimmed');
  }
  return classes.join(' ');
}

export function KanbanCard({
  card,
  keyPrefix,
  index,
  parentTitle,
  childCount,
  progress,
  assignee,
  blocked,
  labels,
  today,
  dimmed,
  open,
  dragging,
  grabbed,
  dropBefore,
  locked = false,
  instructionsId,
  actions,
}: Readonly<KanbanCardProps>) {
  return (
    <li
      className={cardClassName({ open, dragging, grabbed, dropBefore, dimmed })}
      draggable={!locked}
      data-card-index={index}
      onDragStart={(event) => actions.onDragStart(event, card.id)}
      onDragEnd={actions.onDragEnd}
    >
      <div className="card-body d-flex gap-2 align-items-start p-2">
        <button
          type="button"
          className="btn btn-sm btn-ghost-secondary kanban-card__handle"
          aria-label={`Mover ${card.title}`}
          disabled={locked}
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
          <span className="kanban-card__key small text-body-secondary">
            {cardKey({ card, prefix: keyPrefix })}
          </span>
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
          <KanbanCardMeta
            card={card}
            labels={labels}
            childCount={childCount}
            today={today}
            assignee={assignee}
            progress={progress}
            blocked={blocked}
          />
          {dimmed ? (
            <span className="visually-hidden">Fora da busca.</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

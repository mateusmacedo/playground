import { cilChevronRight } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { type DragEvent, type ReactNode, useId } from 'react';

import { InlineAddForm } from './inline-add-form';
import {
  CardCount,
  KanbanLaneHeader,
  type LaneHeaderActions,
} from './kanban-lane-header';
import type { BoardLane } from './model/board';
import { isOverLimit } from './model/lanes';

/** Estado visual da coluna durante o arraste e o movimento pelo teclado. */
export interface LaneMoveState {
  /** Coluna sendo arrastada pelo mouse ou pelo toque. */
  readonly dragging: boolean;
  /** Coluna pega pelo teclado. */
  readonly grabbed: boolean;
  /** Linha de inserção de coluna à esquerda desta. */
  readonly dropBefore: boolean;
  /** Linha de inserção de coluna à direita desta, quando ela é a última. */
  readonly dropAfter: boolean;
  /** Linha de inserção de card depois do último card. */
  readonly cardDropAtEnd: boolean;
  /** Coluna recolhida numa faixa estreita, que ainda recebe cards arrastados. */
  readonly collapsed: boolean;
}

export interface KanbanLaneProps {
  readonly lane: BoardLane;
  /** Posição da coluna no quadro, lida pelo arraste de colunas. */
  readonly index: number;
  readonly moveState: LaneMoveState;
  readonly canRemove: boolean;
  readonly canHide: boolean;
  readonly instructionsId: string;
  readonly headerActions: LaneHeaderActions;
  readonly onDragOver: (event: DragEvent<HTMLElement>, lane: BoardLane) => void;
  readonly onDragLeave: (event: DragEvent<HTMLElement>, laneId: string) => void;
  readonly onDrop: (event: DragEvent<HTMLElement>, lane: BoardLane) => void;
  readonly onAddCard: (card: {
    readonly laneId: string;
    readonly title: string;
  }) => void;
  /** Os cards da coluna, já na ordem da tela. */
  readonly children: ReactNode;
}

function laneClassName(params: {
  readonly lane: BoardLane;
  readonly moveState: LaneMoveState;
}): string {
  const { lane, moveState } = params;
  const modifiers: readonly [boolean, string][] = [
    [isOverLimit(lane), 'kanban-lane--over-limit'],
    [moveState.dragging, 'kanban-lane--dragging'],
    [moveState.grabbed, 'kanban-lane--grabbed'],
    [moveState.dropBefore, 'kanban-lane--drop-before'],
    [moveState.dropAfter, 'kanban-lane--drop-after'],
    [moveState.collapsed, 'kanban-lane--collapsed'],
    [Boolean(lane.locked), 'kanban-lane--locked'],
    [
      moveState.collapsed && moveState.cardDropAtEnd,
      'kanban-lane--drop-target',
    ],
  ];
  return modifiers.reduce(
    (className, [active, modifier]) =>
      active ? `${className} ${modifier}` : className,
    'card kanban-lane bg-body-tertiary',
  );
}

export function KanbanLane({
  lane,
  index,
  moveState,
  canRemove,
  canHide,
  instructionsId,
  headerActions,
  onDragOver,
  onDragLeave,
  onDrop,
  onAddCard,
  children,
}: Readonly<KanbanLaneProps>) {
  const titleId = useId();

  return (
    // WHY: a coluna inteira recebe o drop, inclusive o cabeçalho e o espaço vazio abaixo do último card.
    <section
      className={laneClassName({ lane, moveState })}
      aria-labelledby={titleId}
      data-lane-index={index}
      onDragOver={(event) => onDragOver(event, lane)}
      onDragLeave={(event) => onDragLeave(event, lane.id)}
      onDrop={(event) => onDrop(event, lane)}
    >
      {moveState.collapsed ? (
        <div className="kanban-lane__strip d-flex flex-column align-items-center gap-2 py-2">
          <button
            type="button"
            className="btn btn-sm btn-ghost-secondary"
            aria-label={`Expandir a coluna ${lane.title}`}
            aria-expanded={false}
            onClick={() => headerActions.onToggleCollapse(lane.id)}
          >
            <CIcon icon={cilChevronRight} aria-hidden="true" />
          </button>
          <CardCount lane={lane} />
          <h2
            id={titleId}
            tabIndex={-1}
            data-lane-title={lane.id}
            className="h6 mb-0 kanban-lane__strip-title"
          >
            {lane.title}
          </h2>
        </div>
      ) : (
        <LaneContent
          lane={lane}
          titleId={titleId}
          moveState={moveState}
          canRemove={canRemove}
          canHide={canHide}
          instructionsId={instructionsId}
          headerActions={headerActions}
          onAddCard={onAddCard}
        >
          {children}
        </LaneContent>
      )}
    </section>
  );
}

/** Cabeçalho, cards e inclusão de card da coluna expandida. */
function LaneContent({
  lane,
  titleId,
  moveState,
  canRemove,
  canHide,
  instructionsId,
  headerActions,
  onAddCard,
  children,
}: Readonly<
  Omit<KanbanLaneProps, 'index' | 'onDragOver' | 'onDragLeave' | 'onDrop'> & {
    titleId: string;
  }
>) {
  const count = lane.cards.length;
  return (
    <>
      <KanbanLaneHeader
        lane={lane}
        titleId={titleId}
        grabbed={moveState.grabbed}
        canRemove={canRemove}
        canHide={canHide}
        instructionsId={instructionsId}
        actions={headerActions}
      />
      <div
        className={`card-body kanban-lane__body p-2${moveState.cardDropAtEnd ? ' kanban-lane__body--drop-end' : ''}`}
      >
        {count > 0 ? (
          <ul className="list-unstyled mb-0">{children}</ul>
        ) : (
          <p className="small text-body-secondary text-center mb-0 py-3">
            Nenhum card nesta coluna.
          </p>
        )}
      </div>
      <div className="card-footer border-0 bg-transparent p-2 pt-0">
        {lane.locked ? (
          <p className="small text-body-secondary text-center mb-0">
            Coluna bloqueada: libere para mover ou criar cards.
          </p>
        ) : (
          <InlineAddForm
            buttonLabel="Adicionar card"
            inputLabel={`Título do novo card em ${lane.title}`}
            keepOpen
            onAdd={(title) => onAddCard({ laneId: lane.id, title })}
          />
        )}
      </div>
    </>
  );
}

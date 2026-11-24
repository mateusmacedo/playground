import { type DragEvent, type ReactNode, useId } from 'react';

import { InlineAddForm } from './inline-add-form';
import { KanbanLaneHeader, type LaneHeaderActions } from './kanban-lane-header';
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
}

export interface KanbanLaneProps {
  readonly lane: BoardLane;
  /** Posição da coluna no quadro, lida pelo arraste de colunas. */
  readonly index: number;
  readonly moveState: LaneMoveState;
  readonly canRemove: boolean;
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
  instructionsId,
  headerActions,
  onDragOver,
  onDragLeave,
  onDrop,
  onAddCard,
  children,
}: Readonly<KanbanLaneProps>) {
  const titleId = useId();
  const count = lane.cards.length;

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
      <KanbanLaneHeader
        lane={lane}
        titleId={titleId}
        grabbed={moveState.grabbed}
        canRemove={canRemove}
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
        <InlineAddForm
          buttonLabel="Adicionar card"
          inputLabel={`Título do novo card em ${lane.title}`}
          keepOpen
          onAdd={(title) => onAddCard({ laneId: lane.id, title })}
        />
      </div>
    </section>
  );
}

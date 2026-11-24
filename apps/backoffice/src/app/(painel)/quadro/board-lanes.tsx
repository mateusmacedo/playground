import type { ReactNode } from 'react';

import { InlineAddForm } from './inline-add-form';
import type { RenderCard } from './kanban-card';
import { KanbanLane, type NewCard } from './kanban-lane';
import type { LaneHeaderActions } from './kanban-lane-header';
import type { BoardLane } from './model/board';
import type { BoardDrags } from './use-board-drags';

export interface BoardLanesProps {
  /** As colunas que estão na tela, na ordem. */
  readonly lanes: readonly BoardLane[];
  /** Quantas colunas o quadro tem, contando as ocultas; a última não pode ser excluída. */
  readonly totalLanes: number;
  readonly collapsed: ReadonlySet<string>;
  readonly drags: BoardDrags;
  /** Coluna pega pelo teclado, esperando as setas. */
  readonly grabbedLaneId: string | null;
  readonly instructionsId: string;
  readonly headerActions: LaneHeaderActions;
  readonly renderCard: RenderCard;
  readonly onAddCard: (card: NewCard) => void;
  readonly onAddLane: (title: string) => void;
  /** A coluna de arquivados, que vem depois das colunas do quadro. */
  readonly archiveLane: ReactNode;
}

/** As colunas do quadro lado a lado, com a coluna de arquivados e o campo de nova coluna no fim. */
export function BoardLanes({
  lanes,
  totalLanes,
  collapsed,
  drags,
  grabbedLaneId,
  instructionsId,
  headerActions,
  renderCard,
  onAddCard,
  onAddLane,
  archiveLane,
}: Readonly<BoardLanesProps>) {
  const lastIndex = lanes.length - 1;
  const visibleDrop = drags.card.visibleDrop;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: só recebe o arraste das colunas, que pode terminar entre duas delas; pelo teclado, a coluna se move pela alça
    <div
      className="kanban-board__lanes d-flex gap-3 overflow-x-auto p-2"
      onDragOver={drags.lane.onDragOver}
      onDragLeave={drags.lane.onDragLeave}
      onDrop={drags.lane.onDrop}
    >
      {lanes.map((lane, laneIndex) => {
        const cardDrop = visibleDrop?.laneId === lane.id ? visibleDrop : null;
        const isLast = laneIndex === lastIndex;
        return (
          <KanbanLane
            key={lane.id}
            lane={lane}
            index={laneIndex}
            moveState={{
              dragging: drags.lane.draggedLaneId === lane.id,
              grabbed: grabbedLaneId === lane.id,
              dropBefore: drags.lane.visibleSlot === laneIndex,
              dropAfter: isLast && drags.lane.visibleSlot === lanes.length,
              cardDropAtEnd: cardDrop?.slot === lane.cards.length,
              collapsed: collapsed.has(lane.id),
            }}
            canRemove={totalLanes > 1}
            canHide={lanes.length > 1}
            instructionsId={instructionsId}
            headerActions={headerActions}
            onDragOver={(event, target) => {
              // NOTE: sem o `preventDefault`, o navegador não aceita soltar o card na coluna bloqueada.
              if (!target.locked) {
                drags.card.onDragOver(event, target);
              }
            }}
            onDragLeave={drags.card.onDragLeave}
            onDrop={drags.card.onDrop}
            onAddCard={onAddCard}
          >
            {lane.cards.map((card, index) =>
              renderCard({
                card,
                lane,
                index,
                dropBefore: cardDrop?.slot === index,
              }),
            )}
          </KanbanLane>
        );
      })}
      {archiveLane}
      <div className="kanban-board__add-lane">
        <InlineAddForm
          buttonLabel="Adicionar coluna"
          inputLabel="Nome da nova coluna"
          onAdd={onAddLane}
        />
      </div>
    </div>
  );
}

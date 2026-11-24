import { type DragEvent, type ReactNode, useId } from 'react';

import type { BoardCard, BoardLane } from './model/board';
import { cardKey } from './model/card-key';
import { type ChildProgress, progressText } from './model/completion';
import type { ParentGroup } from './model/views';

/**
 * Quadro em linhas, uma por card pai, com as colunas lado a lado em cada linha. Soltar um card arrastado numa célula
 * leva o card para o fim daquela coluna; a ordem dentro da coluna se muda no quadro sem linhas.
 */
export function Swimlanes({
  groups,
  keyPrefix,
  progress,
  dropTarget,
  renderCard,
  onDragOver,
  onDragLeave,
  onDrop,
}: Readonly<{
  groups: readonly ParentGroup[];
  keyPrefix: string;
  progress: ReadonlyMap<string, ChildProgress>;
  /** Célula sob o card arrastado, como `<pai>:<coluna>`. */
  dropTarget: string | null;
  renderCard: (card: BoardCard, lane: BoardLane, index: number) => ReactNode;
  onDragOver: (event: DragEvent<HTMLElement>, target: CellTarget) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>, target: CellTarget) => void;
}>) {
  if (groups.length === 0) {
    return (
      <p className="text-body-secondary p-2 mb-0">
        Nenhum card nas colunas visíveis.
      </p>
    );
  }
  return (
    <div className="kanban-swimlanes d-grid gap-3 p-2">
      {groups.map((group) => (
        <SwimlaneRow
          key={group.parent?.id ?? 'sem-pai'}
          group={group}
          keyPrefix={keyPrefix}
          progress={group.parent ? progress.get(group.parent.id) : undefined}
          dropTarget={dropTarget}
          renderCard={renderCard}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
}

/** Célula de uma linha: a coluna e o card pai da linha. */
export interface CellTarget {
  readonly lane: BoardLane;
  readonly parentId: string | undefined;
}

export function cellId(target: CellTarget): string {
  return `${target.parentId ?? ''}:${target.lane.id}`;
}

function SwimlaneRow({
  group,
  keyPrefix,
  progress,
  dropTarget,
  renderCard,
  onDragOver,
  onDragLeave,
  onDrop,
}: Readonly<{
  group: ParentGroup;
  keyPrefix: string;
  progress: ChildProgress | undefined;
  dropTarget: string | null;
  renderCard: (card: BoardCard, lane: BoardLane, index: number) => ReactNode;
  onDragOver: (event: DragEvent<HTMLElement>, target: CellTarget) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>, target: CellTarget) => void;
}>) {
  const titleId = useId();
  const { parent } = group;
  const name = parent ? parent.title : 'Sem card pai';
  return (
    <section
      className="card kanban-swimlane bg-body-tertiary"
      aria-labelledby={titleId}
    >
      <header className="card-header d-flex align-items-center gap-2 py-1 px-2">
        <h2 id={titleId} className="h6 mb-0">
          {parent ? (
            <>
              <span className="text-body-secondary fw-normal">
                {cardKey({ card: parent, prefix: keyPrefix })}
              </span>{' '}
            </>
          ) : null}
          {name}
        </h2>
        {progress ? (
          <span className="badge bg-body-secondary text-body border">
            {progressText(progress)}
          </span>
        ) : null}
      </header>
      <div className="d-flex gap-3 overflow-x-auto p-2">
        {group.cells.map(({ lane, cards }) => {
          const target = { lane, parentId: parent?.id };
          const active = dropTarget === cellId(target);
          return (
            // biome-ignore lint/a11y/useSemanticElements: a célula agrupa os cards da coluna dentro da linha; pelo teclado, o card se move pela alça
            <div
              key={lane.id}
              role="group"
              aria-label={`${lane.title} em ${name}`}
              className={`kanban-swimlane__cell${lane.locked ? ' kanban-swimlane__cell--locked' : ''}${active ? ' kanban-lane--drop-target' : ''}`}
              onDragOver={(event) => onDragOver(event, target)}
              onDragLeave={onDragLeave}
              onDrop={(event) => onDrop(event, target)}
            >
              <p className="small fw-semibold text-body-secondary mb-1">
                {lane.title}
              </p>
              {cards.length > 0 ? (
                <ul className="list-unstyled mb-0">
                  {cards.map((card, index) => renderCard(card, lane, index))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { type DragEvent, useId } from 'react';

import type { RenderCard } from './kanban-card';
import type { BoardCard, BoardLane } from './model/board';
import { cardKey } from './model/card-key';
import { type ChildProgress, progressText } from './model/completion';
import type { ParentGroup } from './model/views';

/** Célula de uma linha: a coluna e o card pai da linha. */
export interface CellTarget {
  readonly lane: BoardLane;
  readonly parentId: string | undefined;
}

/** Identificador da célula, para marcar qual delas está sob o card arrastado. */
export function cellId(target: CellTarget): string {
  return `${target.parentId ?? ''}:${target.lane.id}`;
}

/** O que cada célula faz com o card arrastado. */
export interface CellDropHandlers {
  readonly onDragOver: (
    event: DragEvent<HTMLElement>,
    target: CellTarget,
  ) => void;
  readonly onDragLeave: (event: DragEvent<HTMLElement>) => void;
  readonly onDrop: (event: DragEvent<HTMLElement>, target: CellTarget) => void;
}

export interface SwimlanesProps extends CellDropHandlers {
  readonly groups: readonly ParentGroup[];
  /** Prefixo do código dos cards do quadro. */
  readonly keyPrefix: string;
  readonly progress: ReadonlyMap<string, ChildProgress>;
  /** Célula sob o card arrastado, no formato de `cellId`; `null` fora de um arraste. */
  readonly dropTarget: string | null;
  readonly renderCard: RenderCard;
}

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
}: Readonly<SwimlanesProps>) {
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

interface SwimlaneRowProps extends CellDropHandlers {
  readonly group: ParentGroup;
  readonly keyPrefix: string;
  /** Filhos do card pai que já estão na coluna de conclusão. */
  readonly progress: ChildProgress | undefined;
  readonly dropTarget: string | null;
  readonly renderCard: RenderCard;
}

/** Linha de um card pai: o cabeçalho com o pai e uma célula por coluna. */
function SwimlaneRow({
  group,
  keyPrefix,
  progress,
  dropTarget,
  renderCard,
  onDragOver,
  onDragLeave,
  onDrop,
}: Readonly<SwimlaneRowProps>) {
  const titleId = useId();
  const { parent } = group;
  const rowName = parent ? parent.title : 'Sem card pai';

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
          {rowName}
        </h2>
        {progress ? (
          <span className="badge bg-body-secondary text-body border">
            {progressText(progress)}
          </span>
        ) : null}
      </header>
      <div className="d-flex gap-3 overflow-x-auto p-2">
        {group.cells.map((cell) => {
          const target = { lane: cell.lane, parentId: parent?.id };
          return (
            <SwimlaneCell
              key={cell.lane.id}
              target={target}
              cards={cell.cards}
              rowName={rowName}
              dropActive={dropTarget === cellId(target)}
              renderCard={renderCard}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          );
        })}
      </div>
    </section>
  );
}

interface SwimlaneCellProps extends CellDropHandlers {
  readonly target: CellTarget;
  readonly cards: readonly BoardCard[];
  /** Nome da linha, que entra no nome acessível da célula. */
  readonly rowName: string;
  /** Um card arrastado está sobre a célula. */
  readonly dropActive: boolean;
  readonly renderCard: RenderCard;
}

/** Os cards de uma coluna dentro da linha de um card pai. */
function SwimlaneCell({
  target,
  cards,
  rowName,
  dropActive,
  renderCard,
  onDragOver,
  onDragLeave,
  onDrop,
}: Readonly<SwimlaneCellProps>) {
  const { lane } = target;
  const classNames = ['kanban-swimlane__cell'];
  if (lane.locked) {
    classNames.push('kanban-swimlane__cell--locked');
  }
  if (dropActive) {
    classNames.push('kanban-lane--drop-target');
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a célula agrupa os cards da coluna dentro da linha; pelo teclado, o card se move pela alça
    <div
      role="group"
      aria-label={`${lane.title} em ${rowName}`}
      className={classNames.join(' ')}
      onDragOver={(event) => onDragOver(event, target)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, target)}
    >
      <p className="small fw-semibold text-body-secondary mb-1">{lane.title}</p>
      {cards.length > 0 ? (
        <ul className="list-unstyled mb-0">
          {cards.map((card, index) =>
            renderCard({ card, lane, index, dropBefore: false }),
          )}
        </ul>
      ) : null}
    </div>
  );
}

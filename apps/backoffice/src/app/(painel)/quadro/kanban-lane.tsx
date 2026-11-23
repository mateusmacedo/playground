import { type DragEvent, type ReactNode, useId } from 'react';

import type { BoardLane } from './board';

export interface KanbanLaneProps {
  readonly lane: BoardLane;
  /** Mostra a linha de inserção depois do último card. */
  readonly dropAtEnd: boolean;
  readonly onDragOver: (event: DragEvent<HTMLElement>, lane: BoardLane) => void;
  readonly onDragLeave: (event: DragEvent<HTMLElement>, laneId: string) => void;
  readonly onDrop: (event: DragEvent<HTMLElement>, lane: BoardLane) => void;
  /** Os cards da coluna, já na ordem da tela. */
  readonly children: ReactNode;
}

export function KanbanLane({
  lane,
  dropAtEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: Readonly<KanbanLaneProps>) {
  const titleId = useId();
  const count = lane.cards.length;

  return (
    // WHY: a coluna inteira recebe o drop, inclusive o cabeçalho e o espaço vazio abaixo do último card.
    <section
      className="card kanban-lane bg-body-tertiary"
      aria-labelledby={titleId}
      onDragOver={(event) => onDragOver(event, lane)}
      onDragLeave={(event) => onDragLeave(event, lane.id)}
      onDrop={(event) => onDrop(event, lane)}
    >
      <header className="card-header d-flex align-items-center justify-content-between gap-2">
        <h2 id={titleId} className="h6 mb-0">
          {lane.title}
        </h2>
        <span className="badge text-bg-secondary">
          {count}
          <span className="visually-hidden">
            {count === 1 ? ' card' : ' cards'}
          </span>
        </span>
      </header>
      <div
        className={`card-body kanban-lane__body p-2${dropAtEnd ? ' kanban-lane__body--drop-end' : ''}`}
      >
        {count > 0 ? (
          <ul className="list-unstyled mb-0">{children}</ul>
        ) : (
          <p className="small text-body-secondary text-center mb-0 py-3">
            Nenhum card nesta coluna.
          </p>
        )}
      </div>
    </section>
  );
}

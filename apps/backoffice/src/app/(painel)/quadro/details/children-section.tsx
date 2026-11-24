import { useId } from 'react';

import type { BoardCommands } from '../board-commands';
import { InlineAddForm } from '../inline-add-form';
import { type BoardLane, type CardLocation, findCard } from '../model/board';
import { type ChildProgress, progressText } from '../model/completion';
import { childrenOf } from '../model/hierarchy';

export interface ChildrenSectionProps {
  readonly location: CardLocation;
  readonly lanes: readonly BoardLane[];
  /** Filhos na coluna de conclusão, quando o quadro tem uma. */
  readonly progress: ChildProgress | undefined;
  readonly commands: Pick<BoardCommands, 'addCard'>;
  readonly onOpenCard: (cardId: string) => void;
}

/** Cards filhos do card: a lista, o progresso deles e o campo para criar mais um. */
export function ChildrenSection({
  location,
  lanes,
  progress,
  commands,
  onOpenCard,
}: Readonly<ChildrenSectionProps>) {
  const headingId = useId();
  const { card, lane } = location;
  const children = childrenOf({ lanes, cardId: card.id });

  function laneTitleOf(childId: string): string | undefined {
    return findCard({ lanes, cardId: childId })?.lane.title;
  }

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="h6">
        Cards filhos
        {progress ? (
          <span className="fw-normal text-body-secondary">
            {' '}
            ({progressText(progress)})
          </span>
        ) : null}
      </h3>
      {children.length > 0 ? (
        <ul className="list-unstyled d-grid gap-1 mb-2">
          {children.map((child) => (
            <li key={child.id}>
              <button
                type="button"
                className="btn btn-link p-0 text-start align-baseline"
                onClick={() => onOpenCard(child.id)}
              >
                {child.title}
              </button>{' '}
              <span className="small text-body-secondary">
                ({laneTitleOf(child.id)})
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small text-body-secondary mb-2">Nenhum card filho.</p>
      )}
      <InlineAddForm
        buttonLabel="Criar card filho"
        inputLabel={`Título do novo card filho, na coluna ${lane.title}`}
        keepOpen
        onAdd={(title) =>
          commands.addCard({ laneId: lane.id, title, parentId: card.id })
        }
      />
    </section>
  );
}

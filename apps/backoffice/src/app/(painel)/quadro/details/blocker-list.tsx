import { cilX } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton } from '@coreui/react';

import type { BoardCard } from '../model/board';

/** Card que bloqueia o card aberto, com o que a lista mostra dele. */
export interface BlockerRow {
  readonly card: BoardCard;
  readonly laneTitle: string | undefined;
  /** Ainda fora da coluna de conclusão: enquanto estiver, o card aberto fica bloqueado. */
  readonly pending: boolean;
}

export interface BlockerListProps {
  /** Id do título que dá nome à lista. */
  readonly labelledBy: string;
  readonly blockers: readonly BlockerRow[];
  readonly onOpenCard: (cardId: string) => void;
  readonly onRemove: (blocker: BoardCard) => void;
}

/** Lista "Bloqueado por": cada bloqueador com a coluna, a situação e o botão que tira a dependência. */
export function BlockerList({
  labelledBy,
  blockers,
  onOpenCard,
  onRemove,
}: Readonly<BlockerListProps>) {
  if (blockers.length === 0) {
    return <p className="small text-body-secondary mb-2">Nenhum bloqueador.</p>;
  }
  return (
    <ul
      aria-labelledby={labelledBy}
      className="list-unstyled d-grid gap-1 mb-2"
    >
      {blockers.map(({ card, laneTitle, pending }) => (
        <li
          key={card.id}
          className="d-flex align-items-start justify-content-between gap-2"
        >
          <span>
            <button
              type="button"
              className="btn btn-link p-0 text-start align-baseline"
              onClick={() => onOpenCard(card.id)}
            >
              {card.title}
            </button>{' '}
            <span className="small text-body-secondary">({laneTitle})</span>{' '}
            <span
              className={`badge ${pending ? 'text-bg-warning' : 'text-bg-success'}`}
            >
              {pending ? 'Pendente' : 'Concluído'}
            </span>
          </span>
          <CButton
            type="button"
            color="secondary"
            variant="ghost"
            size="sm"
            aria-label={`Remover o bloqueador ${card.title}`}
            onClick={() => onRemove(card)}
          >
            <CIcon icon={cilX} aria-hidden="true" />
          </CButton>
        </li>
      ))}
    </ul>
  );
}

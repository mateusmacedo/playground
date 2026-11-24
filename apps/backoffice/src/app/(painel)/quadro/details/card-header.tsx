import { cilLink } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton } from '@coreui/react';

import type { BoardCard } from '../model/board';

export interface CardHeaderProps {
  readonly card: BoardCard;
  /** Código do card, já com o prefixo do quadro. */
  readonly cardKey: string;
  /** Ancestrais do card, do mais distante para o pai. */
  readonly path: readonly BoardCard[];
  readonly onOpenCard: (cardId: string) => void;
  /** Sem a área de transferência no navegador, o botão de copiar o link não aparece. */
  readonly onCopyLink?: (cardId: string) => void;
}

/** Topo do painel: o código do card, o botão de copiar o link e o caminho dele na hierarquia. */
export function CardHeader({
  card,
  cardKey,
  path,
  onOpenCard,
  onCopyLink,
}: Readonly<CardHeaderProps>) {
  return (
    <>
      <div className="d-flex align-items-center justify-content-between gap-2">
        <span className="badge bg-body-secondary text-body border fs-6">
          {cardKey}
        </span>
        {onCopyLink ? (
          <CButton
            type="button"
            color="secondary"
            variant="ghost"
            size="sm"
            onClick={() => onCopyLink(card.id)}
          >
            <CIcon icon={cilLink} aria-hidden="true" className="me-1" />
            Copiar link
          </CButton>
        ) : null}
      </div>
      {path.length > 0 ? (
        <nav aria-label="Caminho do card na hierarquia">
          <ol className="breadcrumb small mb-0">
            {path.map((ancestor) => (
              <li key={ancestor.id} className="breadcrumb-item">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 align-baseline"
                  onClick={() => onOpenCard(ancestor.id)}
                >
                  {ancestor.title}
                </button>
              </li>
            ))}
            <li className="breadcrumb-item active">{card.title}</li>
          </ol>
        </nav>
      ) : null}
    </>
  );
}

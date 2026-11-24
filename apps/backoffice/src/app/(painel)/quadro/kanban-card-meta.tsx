import { cilCheckAlt } from '@coreui/icons';
import CIcon from '@coreui/icons-react';

import type { BoardCard, BoardLabel } from './model/board';
import { checklistProgress } from './model/checklist';
import { type DueStatus, dueStatus, formatShortDate } from './model/due';

const DUE_STYLE: Readonly<Record<DueStatus, string>> = {
  overdue: 'text-bg-danger',
  today: 'text-bg-warning',
  done: 'text-bg-success',
  upcoming: 'bg-body-secondary text-body border',
};

const DUE_TEXT: Readonly<Record<DueStatus, string>> = {
  overdue: ', atrasado',
  today: ', vence hoje',
  done: ', cumprido',
  upcoming: '',
};

/**
 * Selos do card: etiquetas, prazo, checklist e filhos. A situação do prazo depende do dia de hoje, então só aparece
 * quando `today` chega, depois de montar no navegador.
 */
export function KanbanCardMeta({
  card,
  labels,
  childCount,
  today,
}: Readonly<{
  card: BoardCard;
  labels: readonly BoardLabel[];
  childCount: number;
  today: string | undefined;
}>) {
  const checklist = checklistProgress(card);
  const status = today ? dueStatus({ card, today }) : undefined;
  const hasMeta =
    labels.length > 0 ||
    card.dueDate !== undefined ||
    checklist.total > 0 ||
    childCount > 0;
  if (!hasMeta) {
    return null;
  }
  return (
    <div className="d-flex flex-wrap gap-1 mt-2">
      {labels.map((label) => (
        <span key={label.id} className={`badge text-bg-${label.color}`}>
          {label.name}
        </span>
      ))}
      {card.dueDate ? (
        <span className={`badge ${DUE_STYLE[status ?? 'upcoming']}`}>
          <span className="visually-hidden">Prazo: </span>
          {formatShortDate(card.dueDate)}
          <span className="visually-hidden">
            {status ? DUE_TEXT[status] : ''}
          </span>
        </span>
      ) : null}
      {checklist.total > 0 ? (
        <span
          className={`badge ${checklist.done === checklist.total ? 'text-bg-success' : 'bg-body-secondary text-body border'}`}
        >
          <span aria-hidden="true">
            <CIcon icon={cilCheckAlt} size="sm" className="me-1" />
            {checklist.done}/{checklist.total}
          </span>
          <span className="visually-hidden">
            Checklist: {checklist.done} de {checklist.total} itens feitos
          </span>
        </span>
      ) : null}
      {childCount > 0 ? (
        <span className="badge bg-body-secondary text-body border">
          {childCount} {childCount === 1 ? 'filho' : 'filhos'}
        </span>
      ) : null}
    </div>
  );
}

import { cilCheckAlt, cilCommentBubble, cilPaperclip } from '@coreui/icons';
import CIcon from '@coreui/icons-react';

import type { BoardCard, BoardLabel } from './model/board';
import { checklistProgress } from './model/checklist';
import { type ChildProgress, progressText } from './model/completion';
import { type DueStatus, dueStatus, formatShortDate } from './model/due';
import { initials } from './model/people';

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
  assignee,
  progress,
}: Readonly<{
  card: BoardCard;
  labels: readonly BoardLabel[];
  childCount: number;
  today: string | undefined;
  /** Nome do responsável. */
  assignee?: string;
  /** Filhos na coluna de conclusão, quando o quadro tem uma. */
  progress?: ChildProgress;
}>) {
  const checklist = checklistProgress(card);
  const status = today ? dueStatus({ card, today }) : undefined;
  const comments = card.comments?.length ?? 0;
  const attachments = card.attachments?.length ?? 0;
  const hasMeta =
    labels.length > 0 ||
    card.dueDate !== undefined ||
    checklist.total > 0 ||
    childCount > 0 ||
    comments > 0 ||
    attachments > 0 ||
    assignee !== undefined;
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
      {progress ? (
        <ProgressBadge progress={progress} />
      ) : childCount > 0 ? (
        <span className="badge bg-body-secondary text-body border">
          {childCount} {childCount === 1 ? 'filho' : 'filhos'}
        </span>
      ) : null}
      {comments > 0 ? (
        <span className="badge bg-body-secondary text-body border">
          <CIcon
            icon={cilCommentBubble}
            size="sm"
            className="me-1"
            aria-hidden="true"
          />
          <span aria-hidden="true">{comments}</span>
          <span className="visually-hidden">
            {comments} {comments === 1 ? 'comentário' : 'comentários'}
          </span>
        </span>
      ) : null}
      {attachments > 0 ? (
        <span className="badge bg-body-secondary text-body border">
          <CIcon
            icon={cilPaperclip}
            size="sm"
            className="me-1"
            aria-hidden="true"
          />
          <span aria-hidden="true">{attachments}</span>
          <span className="visually-hidden">
            {attachments} {attachments === 1 ? 'anexo' : 'anexos'}
          </span>
        </span>
      ) : null}
      {assignee ? (
        <span
          className="kanban-card__assignee badge rounded-pill text-bg-primary ms-auto"
          title={assignee}
        >
          <span aria-hidden="true">{initials(assignee)}</span>
          <span className="visually-hidden">Responsável: {assignee}</span>
        </span>
      ) : null}
    </div>
  );
}

/** Filhos concluídos de quantos o card tem, em número e numa barra. */
function ProgressBadge({ progress }: Readonly<{ progress: ChildProgress }>) {
  const complete = progress.done === progress.total;
  const percent = Math.round((progress.done / progress.total) * 100);
  return (
    <span
      className={`badge kanban-card__progress ${complete ? 'text-bg-success' : 'bg-body-secondary text-body border'}`}
    >
      <span aria-hidden="true">
        {progress.done}/{progress.total} filhos
      </span>
      <span className="visually-hidden">{progressText(progress)}</span>
      <span
        className="kanban-card__progress-bar"
        style={{ width: `${percent}%` }}
        aria-hidden="true"
      />
    </span>
  );
}

import { cilCheckAlt, cilCommentBubble, cilPaperclip } from '@coreui/icons';
import CIcon from '@coreui/icons-react';

import type { BoardCard, BoardLabel } from './model/board';
import { checklistProgress } from './model/checklist';
import { type ChildProgress, progressText } from './model/completion';
import { type DueStatus, dueStatus, formatShortDate } from './model/due';
import { initials } from './model/people';

const NEUTRAL_BADGE = 'bg-body-secondary text-body border';

const DUE_STYLE: Readonly<Record<DueStatus, string>> = {
  overdue: 'text-bg-danger',
  today: 'text-bg-warning',
  done: 'text-bg-success',
  upcoming: NEUTRAL_BADGE,
};

const DUE_TEXT: Readonly<Record<DueStatus, string>> = {
  overdue: ', atrasado',
  today: ', vence hoje',
  done: ', cumprido',
  upcoming: '',
};

export interface KanbanCardMetaProps {
  readonly card: BoardCard;
  readonly labels: readonly BoardLabel[];
  readonly childCount: number;
  readonly today: string | undefined;
  /** Nome do responsável. */
  readonly assignee?: string;
  /** Filhos na coluna de conclusão, quando o quadro tem uma. */
  readonly progress?: ChildProgress;
}

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
}: Readonly<KanbanCardMetaProps>) {
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
        <DueBadge dueDate={card.dueDate} status={status} />
      ) : null}
      {checklist.total > 0 ? (
        <ChecklistBadge done={checklist.done} total={checklist.total} />
      ) : null}
      <ChildrenBadge progress={progress} childCount={childCount} />
      <CountBadge
        icon={cilCommentBubble}
        count={comments}
        singular="comentário"
        plural="comentários"
      />
      <CountBadge
        icon={cilPaperclip}
        count={attachments}
        singular="anexo"
        plural="anexos"
      />
      {assignee ? <AssigneeBadge name={assignee} /> : null}
    </div>
  );
}

interface DueBadgeProps {
  readonly dueDate: string;
  /** Situação do prazo; só existe depois que o dia de hoje chega do navegador. */
  readonly status: DueStatus | undefined;
}

function DueBadge({ dueDate, status }: Readonly<DueBadgeProps>) {
  return (
    <span className={`badge ${DUE_STYLE[status ?? 'upcoming']}`}>
      <span className="visually-hidden">Prazo: </span>
      {formatShortDate(dueDate)}
      <span className="visually-hidden">{status ? DUE_TEXT[status] : ''}</span>
    </span>
  );
}

interface ChecklistBadgeProps {
  readonly done: number;
  readonly total: number;
}

function ChecklistBadge({ done, total }: Readonly<ChecklistBadgeProps>) {
  const style = done === total ? 'text-bg-success' : NEUTRAL_BADGE;
  return (
    <span className={`badge ${style}`}>
      <span aria-hidden="true">
        <CIcon icon={cilCheckAlt} size="sm" className="me-1" />
        {done}/{total}
      </span>
      <span className="visually-hidden">
        Checklist: {done} de {total} itens feitos
      </span>
    </span>
  );
}

interface ChildrenBadgeProps {
  readonly progress: ChildProgress | undefined;
  readonly childCount: number;
}

/** Com coluna de conclusão no quadro, o progresso dos filhos; sem ela, só quantos são. */
function ChildrenBadge({ progress, childCount }: Readonly<ChildrenBadgeProps>) {
  if (progress) {
    return <ProgressBadge progress={progress} />;
  }
  if (childCount === 0) {
    return null;
  }
  return (
    <span className={`badge ${NEUTRAL_BADGE}`}>
      {childCount} {childCount === 1 ? 'filho' : 'filhos'}
    </span>
  );
}

interface CountBadgeProps {
  readonly icon: string[];
  readonly count: number;
  /** Nome do que é contado, para o leitor de tela. */
  readonly singular: string;
  readonly plural: string;
}

/** Quantos comentários ou anexos o card tem; sem nenhum, o selo não aparece. */
function CountBadge({
  icon,
  count,
  singular,
  plural,
}: Readonly<CountBadgeProps>) {
  if (count === 0) {
    return null;
  }
  return (
    <span className={`badge ${NEUTRAL_BADGE}`}>
      <CIcon icon={icon} size="sm" className="me-1" aria-hidden="true" />
      <span aria-hidden="true">{count}</span>
      <span className="visually-hidden">
        {count} {count === 1 ? singular : plural}
      </span>
    </span>
  );
}

interface AssigneeBadgeProps {
  readonly name: string;
}

function AssigneeBadge({ name }: Readonly<AssigneeBadgeProps>) {
  return (
    <span
      className="kanban-card__assignee badge rounded-pill text-bg-primary ms-auto"
      title={name}
    >
      <span aria-hidden="true">{initials(name)}</span>
      <span className="visually-hidden">Responsável: {name}</span>
    </span>
  );
}

interface ProgressBadgeProps {
  readonly progress: ChildProgress;
}

/** Filhos concluídos de quantos o card tem, em número e numa barra. */
function ProgressBadge({ progress }: Readonly<ProgressBadgeProps>) {
  const complete = progress.done === progress.total;
  const percent = Math.round((progress.done / progress.total) * 100);
  const style = complete ? 'text-bg-success' : NEUTRAL_BADGE;
  return (
    <span className={`badge kanban-card__progress ${style}`}>
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

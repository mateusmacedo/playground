import { cilSitemap, cilWarning } from '@coreui/icons';
import CIcon from '@coreui/icons-react';

import type { RunStatus } from '@/shared/process/run';

import type { BoardCard } from './model/board';
import type { ProcessSummary } from './model/process-summary';
import { runStatusText } from './model/process-text';
import { useProcessBoard } from './use-process-board';

const NEUTRAL_BADGE = 'bg-body-secondary text-body border';

const STATUS_STYLE: Readonly<Record<RunStatus, string>> = {
  running: NEUTRAL_BADGE,
  completed: 'text-bg-success',
  cancelled: NEUTRAL_BADGE,
};

/** O andamento do processo, como o selo o mostra e como o leitor de tela o lê. */
interface BadgeText {
  /** O que aparece depois do nome: as etapas feitas do total ou a situação. */
  readonly shown: string;
  readonly spoken: string;
}

function badgeText(summary: ProcessSummary | undefined): BadgeText {
  // NOTE: sem resumo, o quadro não tem o roteiro da execução, e não há como contar as etapas.
  if (!summary) {
    return { shown: '', spoken: 'sem roteiro no quadro' };
  }
  if (summary.status !== 'running') {
    const status = runStatusText(summary.status).toLowerCase();
    return { shown: status, spoken: status };
  }
  const { done, total } = summary.progress;
  const steps = total === 1 ? 'etapa feita' : 'etapas feitas';
  const late = summary.overdue ? ', com etapa atrasada' : '';
  return {
    shown: `${done}/${total}`,
    spoken: `${done} de ${total} ${steps}${late}`,
  };
}

export interface ProcessBadgeProps {
  readonly card: BoardCard;
}

/**
 * Selo do processo do card, na face do card e na lista: o nome do processo, as etapas feitas do total e a marca de
 * atrasada, que vem com ícone e texto, e não só com a cor. O card sem processo não tem selo.
 */
export function ProcessBadge({ card }: Readonly<ProcessBadgeProps>) {
  const { summaries } = useProcessBoard();
  const run = card.process;
  if (!run) {
    return null;
  }
  const summary = summaries.get(card.id);
  const text = badgeText(summary);
  const overdue = summary?.overdue ?? false;
  const style = overdue ? 'text-bg-danger' : STATUS_STYLE[run.status];

  return (
    <span className={`badge kanban-card__process ${style}`}>
      <span aria-hidden="true">
        <CIcon icon={cilSitemap} size="sm" className="me-1" />
        {run.name} {text.shown}
        {overdue ? (
          <>
            <CIcon icon={cilWarning} size="sm" className="mx-1" />
            atrasada
          </>
        ) : null}
      </span>
      <span className="visually-hidden">
        Processo {run.name}: {text.spoken}
      </span>
    </span>
  );
}

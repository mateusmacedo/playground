import { CFormCheck, CFormInput } from '@coreui/react';
import { useId } from 'react';

import { useIsClient } from '@/shared/hooks/use-is-client';

import type { BoardCard } from '../model/board';
import { type DueStatus, dueStatus, todayIso } from '../model/due';
import type { BoardCommands } from '../use-board';

const STATUS_TEXT: Readonly<Record<DueStatus, string>> = {
  overdue: 'Atrasado.',
  today: 'Vence hoje.',
  done: 'Cumprido.',
  upcoming: '',
};

const STATUS_CLASS: Readonly<Record<DueStatus, string>> = {
  overdue: 'text-danger',
  today: 'text-warning-emphasis',
  done: 'text-success',
  upcoming: '',
};

export interface DueFieldProps {
  readonly card: BoardCard;
  readonly commands: Pick<BoardCommands, 'setDueDate' | 'setDueDone'>;
}

/** Prazo do card: a data, a marca de cumprido e a situação em relação a hoje. */
export function DueField({ card, commands }: Readonly<DueFieldProps>) {
  const id = useId();
  const isClient = useIsClient();
  const status = isClient ? dueStatus({ card, today: todayIso() }) : undefined;
  return (
    <fieldset>
      <legend className="fs-6 fw-semibold">Prazo</legend>
      <div className="d-flex flex-wrap align-items-center gap-3">
        <CFormInput
          id={`${id}-date`}
          type="date"
          size="sm"
          className="w-auto"
          aria-label="Data do prazo"
          value={card.dueDate ?? ''}
          onChange={(event) =>
            commands.setDueDate({
              cardId: card.id,
              dueDate: event.target.value || undefined,
            })
          }
        />
        <CFormCheck
          id={`${id}-done`}
          label="Prazo cumprido"
          disabled={!card.dueDate}
          checked={card.dueDone ?? false}
          onChange={(event) =>
            commands.setDueDone({ cardId: card.id, done: event.target.checked })
          }
        />
        {status && STATUS_TEXT[status] ? (
          <span className={`small fw-semibold ${STATUS_CLASS[status]}`}>
            {STATUS_TEXT[status]}
          </span>
        ) : null}
      </div>
    </fieldset>
  );
}

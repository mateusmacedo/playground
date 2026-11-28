import type { RunEvent } from '@/shared/process/run';

import { runEventText } from '../model/process-text';
import { ProcessMoment } from './process-moment';

interface TrailEntryProps {
  readonly event: RunEvent;
}

/** Um registro da trilha: o que aconteceu, quando, quem agiu, a observação e os campos preenchidos. */
function TrailEntry({ event }: Readonly<TrailEntryProps>) {
  const values = event.values ?? [];
  return (
    <li>
      <span>{runEventText(event)}</span>{' '}
      <ProcessMoment at={event.at} className="text-body-secondary" />
      {event.by ? (
        <span className="text-body-secondary"> · por {event.by}</span>
      ) : null}
      {event.note ? (
        <p className="mb-0 kanban-comment__text">Observação: {event.note}</p>
      ) : null}
      {values.length > 0 ? (
        <dl className="kanban-process__facts mb-0">
          {values.map((entry) => (
            <div key={entry.label}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

export interface ProcessTrailProps {
  readonly log: readonly RunEvent[];
  /** A trilha já aparece aberta, como na execução encerrada. */
  readonly open?: boolean;
}

/**
 * Trilha da execução, do registro mais antigo para o mais recente. Fica recolhida enquanto o processo anda, porque
 * cresce a cada ação e o que importa nessa hora são as etapas ativas.
 */
export function ProcessTrail({
  log,
  open = false,
}: Readonly<ProcessTrailProps>) {
  const count = log.length === 1 ? '1 registro' : `${log.length} registros`;
  return (
    <details className="kanban-process__trail" open={open}>
      <summary>Trilha da execução ({count})</summary>
      <ol className="list-unstyled d-grid gap-2 mt-2 mb-0 small">
        {log.map((event, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: o registro não tem identidade própria e a trilha só cresce no fim
          <TrailEntry key={`${event.at}-${index}`} event={event} />
        ))}
      </ol>
    </details>
  );
}

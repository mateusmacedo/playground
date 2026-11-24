import { useId } from 'react';

import { activityText } from '../model/activity';
import type { CardActivity } from '../model/board';

const moment = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatMoment(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? '' : moment.format(date);
}

export interface ActivityListProps {
  readonly activity: readonly CardActivity[];
}

/** Histórico do card, do mais recente para o mais antigo. */
export function ActivityList({ activity }: Readonly<ActivityListProps>) {
  const id = useId();
  const recentFirst = [...activity].reverse();
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="h6">
        Histórico
      </h3>
      {recentFirst.length > 0 ? (
        <ol className="list-unstyled d-grid gap-2 mb-0 small">
          {recentFirst.map((entry, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: o registro não tem identidade própria e a lista só cresce no topo
            <li key={`${entry.at}-${index}`}>
              <span>{activityText(entry)}</span>{' '}
              <time dateTime={entry.at} className="text-body-secondary">
                {formatMoment(entry.at)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="small text-body-secondary mb-0">Nenhum registro ainda.</p>
      )}
    </section>
  );
}

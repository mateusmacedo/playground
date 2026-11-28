const moment = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/** Data e hora curtas, no fuso de quem vê; vazio quando o instante é ilegível. */
export function formatMoment(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? '' : moment.format(date);
}

export interface ProcessMomentProps {
  /** Instante, ISO 8601. */
  readonly at: string;
  readonly className?: string;
}

/** Um instante do processo (prazo, registro da trilha, encerramento), legível e também para as máquinas. */
export function ProcessMoment({ at, className }: Readonly<ProcessMomentProps>) {
  return (
    <time dateTime={at} className={className}>
      {formatMoment(at)}
    </time>
  );
}

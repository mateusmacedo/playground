import { cardKey } from './model/card-key';
import type { PendingStep } from './model/pending-steps';
import { stepKindText } from './model/step-kind-text';
import { stepRole } from './pending-steps-roles';

const COLUMNS: readonly string[] = [
  'Card',
  'Coluna',
  'Etapa',
  'Tipo',
  'Papel',
  'Responsável',
  'Desde',
  'Prazo',
];

const moment = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatMoment(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? '' : moment.format(date);
}

export interface PendingStepsTableProps {
  /** As etapas a mostrar, já filtradas e na ordem de prazo. */
  readonly steps: readonly PendingStep[];
  readonly keyPrefix: string;
  readonly onOpen: (cardId: string) => void;
}

/**
 * Tabela das etapas pendentes: uma etapa por linha, com o card dono, a coluna dele, o tipo, o papel, o responsável,
 * desde quando espera e o prazo. A etapa atrasada vem destacada e com o selo "Atrasada"; o título do card abre o card.
 */
export function PendingStepsTable({
  steps,
  keyPrefix,
  onOpen,
}: Readonly<PendingStepsTableProps>) {
  return (
    <div className="table-responsive kanban-steps">
      <table className="table table-sm table-hover align-middle mb-0">
        <caption className="visually-hidden">
          Etapas pendentes do quadro, uma por linha
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <StepRow
              key={`${step.card.id}:${step.active.token.id}`}
              step={step}
              keyPrefix={keyPrefix}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface StepRowProps {
  readonly step: PendingStep;
  readonly keyPrefix: string;
  readonly onOpen: (cardId: string) => void;
}

function StepRow({ step, keyPrefix, onOpen }: Readonly<StepRowProps>) {
  const { card, lane, active } = step;
  const trail = active.trail.map((parent) => parent.label).join(' › ');
  return (
    <tr className={step.overdue ? 'table-danger' : undefined}>
      <td>
        <span className="text-nowrap text-body-secondary me-2">
          {cardKey({ card, prefix: keyPrefix })}
        </span>
        <button
          type="button"
          className="btn btn-link p-0 text-start align-baseline"
          data-card-open={card.id}
          onClick={() => onOpen(card.id)}
        >
          {card.title}
        </button>
      </td>
      <td>{lane.title}</td>
      <th scope="row" className="fw-normal">
        {step.label}
        {trail ? (
          <span className="d-block small text-body-secondary">em {trail}</span>
        ) : null}
      </th>
      <td>{stepKindText(step.kind)}</td>
      <td>{stepRole(step) ?? '—'}</td>
      <td>{step.assignee ?? '—'}</td>
      <td className="text-nowrap">
        <time dateTime={step.since}>{formatMoment(step.since)}</time>
      </td>
      <td className="text-nowrap">
        {step.dueAt ? (
          <time dateTime={step.dueAt}>{formatMoment(step.dueAt)}</time>
        ) : (
          '—'
        )}
        {step.overdue ? (
          <span className="badge text-bg-danger ms-2">Atrasada</span>
        ) : null}
      </td>
    </tr>
  );
}

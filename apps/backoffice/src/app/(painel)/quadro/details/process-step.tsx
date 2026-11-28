import { CButton } from '@coreui/react';
import { useId } from 'react';

import type { ActiveStep } from '@/shared/process/engine-active';

import { type BoardLane, findCard } from '../model/board';
import type { SummaryStep } from '../model/process-summary';
import { stepName } from '../model/process-text';
import { stepKindText } from '../model/step-kind-text';
import type { CardProcessActions } from '../use-card-process';
import { ProcessMoment } from './process-moment';
import { ProcessStepActions } from './process-step-actions';

interface StepFactsProps {
  readonly step: SummaryStep;
}

/** O que a etapa traz do desenho do processo: instruções, resultado esperado, dados do bloco e prazo. */
function StepFacts({ step }: Readonly<StepFactsProps>) {
  const { active, overdue } = step;
  const { instructions, expectedResult, details = [] } = active.step;
  const facts = [
    { label: 'Instruções', value: instructions },
    { label: 'Resultado esperado', value: expectedResult },
    ...details,
  ].filter((fact) => fact.value);
  if (facts.length === 0 && active.dueAt === undefined) {
    return null;
  }
  return (
    <dl className="kanban-process__facts small mb-0">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
      {active.dueAt ? (
        <div>
          <dt>Prazo</dt>
          <dd>
            <ProcessMoment at={active.dueAt} />
            {overdue ? (
              <span className="badge text-bg-danger ms-2">Atrasada</span>
            ) : null}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

interface StepDelegationProps {
  readonly active: ActiveStep;
  readonly lanes: readonly BoardLane[];
  /** Coluna de conclusão do quadro, quando ele tem uma. */
  readonly doneLaneId: string | undefined;
  readonly actions: Pick<CardProcessActions, 'delegate'>;
  readonly onOpenCard: (cardId: string) => void;
}

/** O card filho que executa a etapa, com a coluna em que ele está, ou o botão que cria esse card. */
function StepDelegation({
  active,
  lanes,
  doneLaneId,
  actions,
  onOpenCard,
}: Readonly<StepDelegationProps>) {
  const { token, step } = active;
  const child = token.delegateId
    ? findCard({ lanes, cardId: token.delegateId })
    : undefined;

  if (child) {
    // WHY: o filho concluído só conclui a etapa que não pede mais nada. A que tem campo obrigatório ou escolha
    // continua aberta, e sem este aviso parece que o processo travou.
    const waitsHere = child.lane.id === doneLaneId;
    return (
      <p className="small mb-0">
        Card filho desta etapa:{' '}
        <button
          type="button"
          className="btn btn-link btn-sm p-0 align-baseline"
          onClick={() => onOpenCard(child.card.id)}
        >
          {child.card.title}
        </button>{' '}
        <span className="text-body-secondary">({child.lane.title})</span>
        {waitsHere ? (
          <span className="d-block">
            O card filho já foi concluído. A etapa continua aberta porque pede
            campo obrigatório ou uma escolha: resolva-a aqui.
          </span>
        ) : null}
      </p>
    );
  }
  if (!active.canDelegate) {
    return null;
  }
  return (
    <div>
      <CButton
        type="button"
        color="secondary"
        variant="outline"
        size="sm"
        onClick={() =>
          actions.delegate({ tokenId: token.id, stepLabel: step.label })
        }
      >
        Criar card filho para esta etapa
      </CButton>
    </div>
  );
}

export interface ProcessStepProps {
  readonly step: SummaryStep;
  readonly lanes: readonly BoardLane[];
  /** Coluna de conclusão do quadro, quando ele tem uma. */
  readonly doneLaneId: string | undefined;
  readonly actions: CardProcessActions;
  readonly onOpenCard: (cardId: string) => void;
}

/**
 * Uma etapa em que o processo está parado. A que espera uma ação mostra tudo o que traz e o que dá para fazer nela; a
 * que chegou a uma junção só espera os outros caminhos; o subprocesso aberto só recebe as exceções presas a ele.
 */
export function ProcessStep({
  step,
  lanes,
  doneLaneId,
  actions,
  onOpenCard,
}: Readonly<ProcessStepProps>) {
  const headingId = useId();
  const { active } = step;
  const { state, trail } = active;
  const planStep = active.step;
  const where = trail.map((outer) => stepName(outer.label)).join(' › ');
  const actionable = state === 'pending' || active.events.length > 0;

  return (
    <li
      aria-labelledby={headingId}
      className="kanban-process__step border rounded p-2 d-grid gap-2"
    >
      <div>
        <h4 id={headingId} className="h6 mb-1">
          {stepName(planStep.label)}
        </h4>
        <p className="small text-body-secondary mb-0">
          {stepKindText(planStep.kind)}
          {planStep.role ? ` · Papel: ${planStep.role}` : null}
          {where ? ` · Em ${where}` : null}
        </p>
      </div>
      {state === 'waiting' ? (
        <p className="small mb-0">Aguardando os outros caminhos.</p>
      ) : null}
      {state === 'scope' ? (
        <p className="small mb-0">
          Subprocesso em andamento: as etapas dele aparecem nesta lista.
        </p>
      ) : null}
      {planStep.description ? (
        <p className="small mb-0">{planStep.description}</p>
      ) : null}
      <StepFacts step={step} />
      <StepDelegation
        active={active}
        lanes={lanes}
        doneLaneId={doneLaneId}
        actions={actions}
        onOpenCard={onOpenCard}
      />
      {actionable ? (
        <ProcessStepActions active={active} actions={actions} />
      ) : null}
    </li>
  );
}

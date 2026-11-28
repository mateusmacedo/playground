import { eventDueAt, stepDueAt } from './engine-due';
import {
  allowsManyChoices,
  choicesOf,
  resolutionOf,
  type StepResolution,
  type TokenState,
  tokenState,
} from './engine-kinds';
import {
  type PlanEvent,
  type PlanExit,
  type PlanStep,
  type ProcessPlan,
  stepTrail,
} from './plan';
import type { ProcessRun, RunToken } from './run';

/** Roteiro e execução: o que toda consulta sobre o andamento recebe. */
export interface RunViewParams {
  /** Roteiro da versão em que a execução começou. */
  readonly plan: ProcessPlan;
  readonly run: ProcessRun;
}

/** Exceção que `raise` aceita na etapa, com o instante em que o tempo dela se esgota, quando é por tempo. */
export interface ActiveEvent {
  readonly event: PlanEvent;
  readonly dueAt?: string;
}

/** Uma ficha da execução em andamento, com a etapa em que ela está e o que dá para fazer ali. */
export interface ActiveStep {
  readonly token: RunToken;
  readonly step: PlanStep;
  /** Subprocessos que contêm a etapa, do mais externo ao mais próximo; vazio na raiz. */
  readonly trail: readonly PlanStep[];
  /** `pending` espera uma ação, `waiting` espera os outros caminhos numa junção e `scope` é um subprocesso aberto. */
  readonly state: TokenState;
  /** Prazo da etapa (ISO 8601); a ficha em espera numa junção não tem. */
  readonly dueAt?: string;
  /** Ação que resolve a etapa; só a etapa pendente tem. */
  readonly resolution?: StepResolution;
  /** Saídas que `choose` aceita; vazio quando a etapa não é de escolha. */
  readonly choices: readonly PlanExit[];
  /** Diz se `choose` aceita mais de uma saída. */
  readonly multiple: boolean;
  /** Exceções que `raise` aceita. */
  readonly events: readonly ActiveEvent[];
  /** Diz se `delegate` é aceito: etapa pendente, acionável e ainda sem delegação. */
  readonly canDelegate: boolean;
}

interface TokenStep {
  readonly token: RunToken;
  readonly step: PlanStep;
}

function raisableEvents(params: TokenStep): readonly ActiveEvent[] {
  const { token, step } = params;
  const events: ActiveEvent[] = [];
  for (const event of step.events ?? []) {
    events.push({ event, dueAt: eventDueAt({ event, since: token.since }) });
  }
  return events;
}

interface DescribeParams extends TokenStep {
  readonly trail: readonly PlanStep[];
}

function describeToken(params: DescribeParams): ActiveStep {
  const { token, step, trail } = params;
  const state = tokenState(token);
  if (state === 'waiting') {
    return {
      token,
      step,
      trail,
      state,
      choices: [],
      multiple: false,
      events: [],
      canDelegate: false,
    };
  }
  const resolution = state === 'pending' ? resolutionOf(step) : undefined;
  return {
    token,
    step,
    trail,
    state,
    dueAt: stepDueAt({ step, since: token.since }),
    resolution,
    choices: resolution === 'choose' ? choicesOf(step) : [],
    multiple: allowsManyChoices(step),
    events: raisableEvents({ token, step }),
    canDelegate: resolution !== undefined && token.delegateId === undefined,
  };
}

/**
 * Fichas da execução em andamento, na ordem em que pararam, cada uma com a etapa, a trilha de subprocessos, o prazo
 * e as ações que o motor aceita. Execução encerrada não tem etapa ativa; ficha fora do roteiro fica de fora.
 */
export function activeSteps(params: RunViewParams): readonly ActiveStep[] {
  const { plan, run } = params;
  if (run.status !== 'running') {
    return [];
  }
  const steps: ActiveStep[] = [];
  for (const token of run.tokens) {
    const path = stepTrail({ plan, stepRef: token.stepRef });
    if (path === undefined) {
      continue;
    }
    const step = path[path.length - 1];
    steps.push(describeToken({ token, step, trail: path.slice(0, -1) }));
  }
  return steps;
}

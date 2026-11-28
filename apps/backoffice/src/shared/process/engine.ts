import { openFlow } from './engine-flow';
import { resolutionOf, tokenState } from './engine-kinds';
import { locate, placeIn } from './engine-places';
import {
  ALREADY_DELEGATED,
  accepted,
  DELEGATE_REQUIRED,
  INVALID_PLAN,
  NOT_ACTIONABLE,
  NOT_RUNNING,
  type RunResult,
  refused,
  UNKNOWN_STEP,
  UNKNOWN_TOKEN,
} from './engine-result';
import { conclude } from './engine-settle';
import {
  type ChooseAction,
  type CompleteAction,
  chooseExits,
  cleanText,
  completeStep,
  type RaiseAction,
  raiseEvent,
  type StepTarget,
} from './engine-steps';
import type { ProcessPlan } from './plan';
import {
  appendLog,
  type ProcessRun,
  type RunEvent,
  type RunToken,
} from './run';

/** Liga a etapa a quem vai executá-la fora do processo; o quadro guarda aqui o card filho. */
export interface DelegateAction {
  readonly kind: 'delegate';
  readonly tokenId: string;
  readonly delegateId: string;
}

export interface UndelegateAction {
  readonly kind: 'undelegate';
  readonly tokenId: string;
}

/** Encerra a execução antes do fim, em qualquer ponto. */
export interface CancelAction {
  readonly kind: 'cancel';
  readonly note?: string;
}

export type RunAction =
  | CompleteAction
  | ChooseAction
  | RaiseAction
  | DelegateAction
  | UndelegateAction
  | CancelAction;

/** Número da primeira ficha de uma execução. */
const FIRST_TOKEN = 1;

const CANCELLED_LABEL = 'Processo cancelado';

export interface StartRunParams {
  readonly definitionId: string;
  readonly version: number;
  readonly name: string;
  readonly plan: ProcessPlan;
  /** Instante do início (ISO 8601); o motor nunca lê o relógio. */
  readonly at: string;
  readonly by?: string;
}

/**
 * Inicia a execução de uma versão do processo: põe uma ficha no Início e atravessa os passos automáticos. Recusa o
 * roteiro sem Início e o que entra num laço sem etapa que espere uma ação.
 */
export function startRun(params: StartRunParams): RunResult {
  const { definitionId, version, name, plan, at, by } = params;
  const start = placeIn({ level: plan, id: plan.startId });
  if (start === undefined) {
    return refused(INVALID_PLAN);
  }
  const started: RunEvent = {
    at,
    kind: 'started',
    label: name,
    by: cleanText(by),
  };
  const run: ProcessRun = {
    definitionId,
    version,
    name,
    status: 'running',
    startedAt: at,
    tokens: [],
    log: [started],
    nextToken: FIRST_TOKEN,
    takenExits: [],
  };
  const flow = openFlow({ plan, run, at });
  return conclude({ run, flow: { ...flow, arrivals: [start] } });
}

export interface AdvanceParams {
  /** Roteiro da versão em que a execução começou. */
  readonly plan: ProcessPlan;
  readonly run: ProcessRun;
  readonly action: RunAction;
  /** Instante da ação (ISO 8601); o motor nunca lê o relógio. */
  readonly at: string;
  readonly by?: string;
}

interface CancelParams extends AdvanceParams {
  readonly action: CancelAction;
}

/** Nomes das etapas que esperavam uma ação, para o histórico dizer onde a execução parou. */
function pendingLabels(params: CancelParams): string | undefined {
  const { plan, run } = params;
  const labels = new Set<string>();
  for (const token of run.tokens) {
    const place = locate({ plan, stepRef: token.stepRef });
    if (place !== undefined && tokenState(token) === 'pending') {
      labels.add(place.step.label);
    }
  }
  if (labels.size === 0) {
    return undefined;
  }
  return `Etapas pendentes: ${[...labels].join(', ')}`;
}

function cancelRun(params: CancelParams): ProcessRun {
  const { run, action, at, by } = params;
  const cancelled: RunEvent = {
    at,
    kind: 'cancelled',
    label: CANCELLED_LABEL,
    detail: pendingLabels(params),
    note: cleanText(action.note),
    by: cleanText(by),
  };
  return {
    ...run,
    status: 'cancelled',
    endedAt: at,
    tokens: [],
    log: appendLog({ log: run.log, events: [cancelled] }),
  };
}

interface TokenChangeParams {
  readonly run: ProcessRun;
  readonly tokenId: string;
  readonly delegateId: string | undefined;
}

function withDelegate(params: TokenChangeParams): readonly RunToken[] {
  const { run, tokenId, delegateId } = params;
  return run.tokens.map((token) =>
    token.id === tokenId ? { ...token, delegateId } : token,
  );
}

interface DelegateParams {
  readonly target: StepTarget;
  readonly action: DelegateAction;
}

function delegateStep(params: DelegateParams): RunResult {
  const { target, action } = params;
  const { run, token, place, at, by } = target;
  const actionable =
    tokenState(token) === 'pending' && resolutionOf(place.step) !== undefined;
  if (!actionable) {
    return refused(NOT_ACTIONABLE);
  }
  // WHY: delegar de novo criaria um segundo executor para a mesma parada; quem quer trocar desfaz antes.
  if (token.delegateId !== undefined) {
    return refused(ALREADY_DELEGATED);
  }
  const delegateId = cleanText(action.delegateId);
  if (delegateId === undefined) {
    return refused(DELEGATE_REQUIRED);
  }
  const delegated: RunEvent = {
    at,
    kind: 'delegated',
    stepRef: place.stepRef,
    label: place.step.label,
    by: cleanText(by),
  };
  return accepted({
    ...run,
    tokens: withDelegate({ run, tokenId: token.id, delegateId }),
    log: appendLog({ log: run.log, events: [delegated] }),
  });
}

function undelegateStep(target: StepTarget): RunResult {
  const { run, token } = target;
  // NOTE: sem delegação, repetir a ação não muda nada: a execução volta como veio.
  if (token.delegateId === undefined) {
    return accepted(run);
  }
  const tokens = withDelegate({
    run,
    tokenId: token.id,
    delegateId: undefined,
  });
  return accepted({ ...run, tokens });
}

/**
 * Aplica uma ação à execução e atravessa os passos automáticos que ela libera. Devolve uma execução nova, sem mudar
 * a recebida; o que a execução não aceita volta como recusa, com código e mensagem, nunca como exceção.
 */
export function advance(params: AdvanceParams): RunResult {
  const { plan, run, action, at, by } = params;
  if (run.status !== 'running') {
    return refused(NOT_RUNNING);
  }
  if (action.kind === 'cancel') {
    return accepted(cancelRun({ ...params, action }));
  }
  const token = run.tokens.find((item) => item.id === action.tokenId);
  if (token === undefined) {
    return refused(UNKNOWN_TOKEN);
  }
  const place = locate({ plan, stepRef: token.stepRef });
  if (place === undefined) {
    return refused(UNKNOWN_STEP);
  }
  const target: StepTarget = { plan, run, at, by, token, place };
  switch (action.kind) {
    case 'complete':
      return completeStep({ target, action });
    case 'choose':
      return chooseExits({ target, action });
    case 'raise':
      return raiseEvent({ target, action });
    case 'delegate':
      return delegateStep({ target, action });
    case 'undelegate':
      return undelegateStep(target);
  }
}

import { advance, type RunAction, startRun } from './engine';
import { type LocateParams, locate, type Place } from './engine-places';
import type { RunResult } from './engine-result';
import type { FieldValues } from './fields';
import type {
  PlanDuration,
  PlanEvent,
  PlanEventTrigger,
  PlanOutcome,
  PlanStep,
  ProcessPlan,
  StepKind,
  StepRef,
} from './plan';
import type { ProcessRun, RunToken } from './run';

/** Instante em que as execuções de teste começam. */
export const STARTED_AT = '2026-11-26T10:00:00.000Z';
/** Instante padrão das ações de teste: uma hora depois do início. */
export const ACTED_AT = '2026-11-26T11:00:00.000Z';

/** Id da saída única das etapas de teste. */
const OUT = 'out';

export interface StepParams {
  readonly id: string;
  /** Tipo da etapa; sem ele, uma tarefa. */
  readonly kind?: StepKind;
  /** Destino da saída única. */
  readonly to?: string;
  readonly data?: Partial<PlanStep>;
}

/** Etapa de saída única; o rótulo é o id. */
export function step(params: StepParams): PlanStep {
  const { id, kind = 'task', to, data = {} } = params;
  return {
    id,
    kind,
    label: id,
    exits: [{ id: OUT, meaning: 'next', to }],
    ...data,
  };
}

export interface BranchingParams {
  readonly id: string;
  readonly kind: StepKind;
  /** Destino de cada ramo, pelo id da saída; o rótulo do ramo é o id. */
  readonly branches: Readonly<Record<string, string | undefined>>;
  readonly data?: Partial<PlanStep>;
}

/** Etapa com um ramo por saída: decisão, decisão inclusiva ou abertura paralela. */
export function branching(params: BranchingParams): PlanStep {
  const { id, kind, branches, data = {} } = params;
  const exits = Object.entries(branches).map(([exitId, to]) => ({
    id: exitId,
    meaning: 'branch' as const,
    label: exitId,
    to,
  }));
  return { id, kind, label: id, exits, ...data };
}

export interface EndParams {
  readonly id: string;
  readonly outcome?: PlanOutcome;
}

export function end(params: EndParams): PlanStep {
  const { id, outcome } = params;
  return { id, kind: 'end', label: id, exits: [], outcome };
}

export interface ApprovalParams {
  readonly id: string;
  readonly approved?: string;
  readonly rejected?: string;
  readonly data?: Partial<PlanStep>;
}

export function approval(params: ApprovalParams): PlanStep {
  const { id, approved, rejected, data = {} } = params;
  return {
    id,
    kind: 'approval',
    label: id,
    exits: [
      { id: 'approved', meaning: 'approved', to: approved },
      { id: 'rejected', meaning: 'rejected', to: rejected },
    ],
    ...data,
  };
}

export interface WaitEventParams {
  readonly id: string;
  readonly received?: string;
  readonly expired?: string;
  /** Prazo da espera; sem ele, o motor não oferece a saída de prazo expirado. */
  readonly deadline?: PlanDuration;
}

/** Espera por evento com as duas saídas no roteiro, para os testes cobrirem a de prazo expirado sem prazo. */
export function waitEvent(params: WaitEventParams): PlanStep {
  const { id, received, expired, deadline } = params;
  return {
    id,
    kind: 'wait-event',
    label: id,
    exits: [
      { id: 'received', meaning: 'received', to: received },
      { id: 'expired', meaning: 'expired', to: expired },
    ],
    deadline,
  };
}

export interface SubprocessParams {
  readonly id: string;
  readonly to?: string;
  /** Etapas do processo interno; a primeira é o início dele. */
  readonly inner: readonly PlanStep[];
  readonly data?: Partial<PlanStep>;
}

export function subprocess(params: SubprocessParams): PlanStep {
  const { id, to, inner, data = {} } = params;
  return step({
    id,
    kind: 'subprocess',
    to,
    data: { inner: planOf(inner), ...data },
  });
}

export interface ExceptionParams {
  readonly id: string;
  readonly to?: string;
  /** Sem valor, a exceção interrompe a etapa. */
  readonly interrupting?: boolean;
  readonly trigger?: PlanEventTrigger;
  readonly timeout?: PlanDuration;
}

/** Exceção presa a uma etapa; o rótulo é o id. */
export function exception(params: ExceptionParams): PlanEvent {
  const { id, to, interrupting = true, trigger = 'error', timeout } = params;
  return { id, label: id, trigger, interrupting, timeout, to };
}

/** Roteiro com as etapas dadas; a primeira é o início. Sem etapas, o início fica vazio e o roteiro é inválido. */
export function planOf(steps: readonly PlanStep[]): ProcessPlan {
  return { startId: steps.at(0)?.id ?? '', steps };
}

// WHY: a recusa inesperada num teste de caminho feliz é falha do teste, e a exceção para o teste na linha certa,
// com a mensagem do motor.
function unwrap(result: RunResult): ProcessRun {
  if (!result.ok) {
    throw new Error(`Recusa inesperada: ${result.refusal.message}`);
  }
  return result.run;
}

/** Inicia a execução de teste do roteiro em `STARTED_AT`; falha o teste quando o motor recusa. */
export function begin(plan: ProcessPlan): ProcessRun {
  const result = startRun({
    definitionId: 'process-1',
    version: 1,
    name: 'Processo',
    plan,
    at: STARTED_AT,
  });
  return unwrap(result);
}

export interface ActParams {
  readonly plan: ProcessPlan;
  readonly run: ProcessRun;
  readonly action: RunAction;
  /** Instante da ação; sem ele, `ACTED_AT`. */
  readonly at?: string;
  readonly by?: string;
}

/** Aplica a ação; falha o teste quando o motor recusa. */
export function act(params: ActParams): ProcessRun {
  const { plan, run, action, at = ACTED_AT, by } = params;
  return unwrap(advance({ plan, run, action, at, by }));
}

export interface TokenAtParams {
  readonly run: ProcessRun;
  readonly stepRef: StepRef;
}

/** A ficha parada na etapa; falha o teste quando não há nenhuma. */
export function tokenAt(params: TokenAtParams): RunToken {
  const { run, stepRef } = params;
  const token = run.tokens.find((item) => item.stepRef === stepRef);
  if (token === undefined) {
    throw new Error(`Nenhuma ficha em ${stepRef}.`);
  }
  return token;
}

/** Endereços das fichas, na ordem em que pararam. */
export function tokenRefs(run: ProcessRun): readonly StepRef[] {
  return run.tokens.map((token) => token.stepRef);
}

/** A etapa do endereço, já localizada; falha o teste quando o roteiro não a tem. */
export function placeAt(params: LocateParams): Place {
  const place = locate(params);
  if (place === undefined) {
    throw new Error(`Nenhuma etapa em ${params.stepRef}.`);
  }
  return place;
}

export interface ResolveParams {
  readonly plan: ProcessPlan;
  readonly run: ProcessRun;
  /** Endereço da etapa a resolver. */
  readonly stepRef: StepRef;
  /** Saídas escolhidas; sem elas, a etapa é concluída. */
  readonly exitIds?: readonly string[];
  readonly note?: string;
  readonly values?: FieldValues;
  readonly at?: string;
}

/** Resolve a etapa do endereço: conclui ou, com `exitIds`, escolhe os caminhos. */
export function resolve(params: ResolveParams): ProcessRun {
  const { plan, run, stepRef, exitIds, note, values, at } = params;
  const tokenId = tokenAt({ run, stepRef }).id;
  const action: RunAction =
    exitIds === undefined
      ? { kind: 'complete', tokenId, note, values }
      : { kind: 'choose', tokenId, exitIds, note, values };
  return act({ plan, run, action, at });
}

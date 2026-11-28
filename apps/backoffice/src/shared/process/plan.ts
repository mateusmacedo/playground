import type { StepField } from './fields';

/** Tipo da etapa: o mesmo nome do tipo do bloco que a originou. */
export type StepKind =
  | 'start'
  | 'task'
  | 'human-task'
  | 'automated-task'
  | 'send-message'
  | 'wait-event'
  | 'timer'
  | 'decision'
  | 'merge'
  | 'inclusive-split'
  | 'inclusive-join'
  | 'parallel-split'
  | 'parallel-join'
  | 'approval'
  | 'subprocess'
  | 'end';

export type ExitMeaning =
  | 'next'
  | 'branch'
  | 'received'
  | 'expired'
  | 'approved'
  | 'rejected';

export type PlanDurationUnit = 'minutes' | 'hours' | 'days' | 'weeks';

/** Intervalo de tempo: quantidade inteira e positiva numa unidade de relógio. */
export interface PlanDuration {
  readonly amount: number;
  readonly unit: PlanDurationUnit;
}

export interface PlanExit {
  /** Id do ponto de saída do bloco. */
  readonly id: string;
  readonly meaning: ExitMeaning;
  readonly label?: string;
  readonly condition?: string;
  readonly description?: string;
  /** Id da etapa de destino, no mesmo nível; sem destino, o caminho termina ali. */
  readonly to?: string;
}

export type PlanEventTrigger = 'error' | 'timeout';

/** Exceção presa a uma etapa: um desvio que só pode ser acionado enquanto a etapa está ativa. */
export interface PlanEvent {
  /** Id do bloco de exceção. */
  readonly id: string;
  readonly label: string;
  readonly trigger: PlanEventTrigger;
  /** Quando não interrompe a etapa, a exceção abre um caminho a mais. */
  readonly interrupting: boolean;
  readonly timeout?: PlanDuration;
  /** Id da etapa de destino, no nível da etapa a que a exceção está presa. */
  readonly to?: string;
}

/** Dado só de leitura do bloco, com o rótulo em PT-BR (sistema, operação, canal, destinatário e afins). */
export interface PlanDetail {
  readonly label: string;
  readonly value: string;
}

export type OutcomeKind =
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'other';

export interface PlanOutcome {
  readonly kind: OutcomeKind;
  readonly label: string;
}

export interface PlanStep {
  /** Id do bloco do desenho, único no nível. */
  readonly id: string;
  readonly kind: StepKind;
  readonly label: string;
  readonly description?: string;
  /** Papel do bloco ou, sem ele, o nome da raia. */
  readonly role?: string;
  readonly instructions?: string;
  readonly expectedResult?: string;
  readonly dueIn?: PlanDuration;
  readonly details?: readonly PlanDetail[];
  readonly fields?: readonly StepField[];
  readonly exits: readonly PlanExit[];
  readonly defaultExitId?: string;
  readonly events?: readonly PlanEvent[];
  /** Prazo da espera por evento; sem ele, não existe a saída de prazo expirado. */
  readonly deadline?: PlanDuration;
  readonly duration?: PlanDuration;
  /** Data e horário locais `AAAA-MM-DDTHH:MM` até quando o temporizador espera. */
  readonly until?: string;
  /** Processo interno do subprocesso; sem ele, o subprocesso vale como tarefa simples. */
  readonly inner?: ProcessPlan;
  readonly outcome?: PlanOutcome;
}

/** Roteiro de um nível (o processo ou um subprocesso): as etapas e por onde começa. */
export interface ProcessPlan {
  readonly startId: string;
  readonly steps: readonly PlanStep[];
}

/**
 * Endereço de uma etapa: os ids do caminho separados por `/`, do subprocesso mais externo até a etapa. Na raiz é o
 * próprio id do bloco.
 */
export type StepRef = string;

/** Separador dos ids num endereço de etapa; por isso um id de etapa não pode contê-lo. */
export const STEP_REF_SEPARATOR = '/';

/** Chave de uma saída percorrida: o endereço da etapa, `:` e o id da saída. */
export type ExitKey = string;

export interface StepRefParams {
  /** Endereço do subprocesso que contém a etapa; sem ele, a etapa é da raiz. */
  readonly scope?: StepRef;
  readonly id: string;
}

/** Endereço da etapa `id`: o próprio id na raiz ou, num subprocesso, o endereço dele seguido do id. */
export function stepRefOf(params: StepRefParams): StepRef {
  const { scope, id } = params;
  return scope === undefined ? id : `${scope}${STEP_REF_SEPARATOR}${id}`;
}

/** Ids do caminho, do subprocesso mais externo até a etapa. */
export function stepRefPath(stepRef: StepRef): readonly string[] {
  return stepRef.split(STEP_REF_SEPARATOR);
}

/** Endereço do subprocesso que contém a etapa; `undefined` quando ela é da raiz. */
export function scopeOf(stepRef: StepRef): StepRef | undefined {
  const cut = stepRef.lastIndexOf(STEP_REF_SEPARATOR);
  return cut < 0 ? undefined : stepRef.slice(0, cut);
}

export interface WithinParams {
  readonly stepRef: StepRef;
  readonly scope: StepRef;
}

/** Diz se a etapa fica dentro do subprocesso `scope`, em qualquer profundidade. */
export function isWithin(params: WithinParams): boolean {
  const { stepRef, scope } = params;
  return stepRef.startsWith(`${scope}${STEP_REF_SEPARATOR}`);
}

export interface StepAtParams {
  readonly plan: ProcessPlan;
  readonly stepRef: StepRef;
}

/**
 * Etapas do caminho, do subprocesso mais externo até a etapa do endereço; `undefined` quando o endereço não leva a
 * uma etapa do roteiro.
 */
export function stepTrail(
  params: StepAtParams,
): readonly PlanStep[] | undefined {
  const { plan, stepRef } = params;
  const trail: PlanStep[] = [];
  let level: ProcessPlan | undefined = plan;
  for (const id of stepRefPath(stepRef)) {
    const step: PlanStep | undefined = level?.steps.find(
      (item) => item.id === id,
    );
    if (step === undefined) {
      return undefined;
    }
    trail.push(step);
    level = step.inner;
  }
  return trail;
}

/** A etapa do endereço, na raiz ou dentro de subprocesso. */
export function stepAt(params: StepAtParams): PlanStep | undefined {
  return stepTrail(params)?.at(-1);
}

export interface PlanAtParams {
  readonly plan: ProcessPlan;
  /** Endereço do subprocesso; sem ele, o nível é a raiz. */
  readonly scope?: StepRef;
}

/** Roteiro de um nível: o da raiz ou o processo interno do subprocesso em `scope`. */
export function planAt(params: PlanAtParams): ProcessPlan | undefined {
  const { plan, scope } = params;
  if (scope === undefined) {
    return plan;
  }
  return stepAt({ plan, stepRef: scope })?.inner;
}

export interface ExitKeyParams {
  readonly stepRef: StepRef;
  /** Id da saída ou, no desvio por exceção, o id da exceção. */
  readonly exitId: string;
}

export function exitKey(params: ExitKeyParams): ExitKey {
  const { stepRef, exitId } = params;
  return `${stepRef}:${exitId}`;
}

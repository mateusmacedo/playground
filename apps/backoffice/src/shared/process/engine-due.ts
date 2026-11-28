import type {
  PlanDuration,
  PlanDurationUnit,
  PlanEvent,
  PlanStep,
} from './plan';

const MINUTE_MS = 60_000;

const UNIT_MS: Readonly<Record<PlanDurationUnit, number>> = {
  minutes: MINUTE_MS,
  hours: 60 * MINUTE_MS,
  days: 24 * 60 * MINUTE_MS,
  weeks: 7 * 24 * 60 * MINUTE_MS,
};

export interface AddDurationParams {
  /** Instante de partida (ISO 8601). */
  readonly from: string;
  readonly duration: PlanDuration;
}

/**
 * Instante `from` mais a duração, em ISO 8601. O dia vale 24 horas e a semana, 7 dias. Quando a conta não dá um
 * instante que o `Date` represente, `from` volta como veio.
 */
export function addDuration(params: AddDurationParams): string {
  const { from, duration } = params;
  const span = duration.amount * UNIT_MS[duration.unit];
  const date = new Date(Date.parse(from) + span);
  return Number.isNaN(date.getTime()) ? from : date.toISOString();
}

export interface StepDueParams {
  readonly step: PlanStep;
  /** Quando a ficha chegou à etapa (ISO 8601). */
  readonly since: string;
}

function timerDueAt(params: StepDueParams): string | undefined {
  const { step, since } = params;
  if (step.duration !== undefined) {
    return addDuration({ from: since, duration: step.duration });
  }
  if (step.until === undefined) {
    return undefined;
  }
  // NOTE: `until` é data e horário locais, sem fuso: o `Date` lê no fuso de quem executa.
  const date = new Date(step.until);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Prazo da etapa para a ficha que chegou em `since`: a duração ou o horário do temporizador, o prazo da espera por
 * evento ou o prazo da atividade. `undefined` quando a etapa não tem prazo.
 */
export function stepDueAt(params: StepDueParams): string | undefined {
  const { step, since } = params;
  if (step.kind === 'timer') {
    return timerDueAt(params);
  }
  const duration = step.kind === 'wait-event' ? step.deadline : step.dueIn;
  if (duration === undefined) {
    return undefined;
  }
  return addDuration({ from: since, duration });
}

export interface EventDueParams {
  readonly event: PlanEvent;
  /** Quando a ficha chegou à etapa a que a exceção está presa (ISO 8601). */
  readonly since: string;
}

/** Quando o tempo da etapa se esgota, para a exceção por tempo; `undefined` nas outras exceções. */
export function eventDueAt(params: EventDueParams): string | undefined {
  const { event, since } = params;
  if (event.trigger !== 'timeout' || event.timeout === undefined) {
    return undefined;
  }
  return addDuration({ from: since, duration: event.timeout });
}

export interface DueCheckParams {
  /** Instante da checagem (ISO 8601). */
  readonly at: string;
  readonly dueAt: string | undefined;
}

/** Diz se `at` ainda não chegou ao prazo; sem prazo, nunca é antes. */
export function isBeforeDue(params: DueCheckParams): boolean {
  const { at, dueAt } = params;
  return dueAt !== undefined && Date.parse(at) < Date.parse(dueAt);
}

/** Diz se `at` já passou do prazo; sem prazo, nunca atrasa. */
export function isOverdue(params: DueCheckParams): boolean {
  const { at, dueAt } = params;
  return dueAt !== undefined && Date.parse(at) > Date.parse(dueAt);
}

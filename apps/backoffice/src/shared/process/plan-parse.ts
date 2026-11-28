import { parseFields } from './fields';
import {
  type ExitMeaning,
  type OutcomeKind,
  type PlanDetail,
  type PlanDuration,
  type PlanDurationUnit,
  type PlanEvent,
  type PlanEventTrigger,
  type PlanExit,
  type PlanOutcome,
  type PlanStep,
  type ProcessPlan,
  STEP_REF_SEPARATOR,
  type StepKind,
} from './plan';
import {
  allValid,
  isFilledText,
  isPositiveInteger,
  isRecord,
  isTimestamp,
  keepValid,
  knownOption,
  optionalText,
  type UnknownRecord,
} from './stored-values';

const STEP_KINDS: readonly StepKind[] = [
  'start',
  'task',
  'human-task',
  'automated-task',
  'send-message',
  'wait-event',
  'timer',
  'decision',
  'merge',
  'inclusive-split',
  'inclusive-join',
  'parallel-split',
  'parallel-join',
  'approval',
  'subprocess',
  'end',
];

const EXIT_MEANINGS: readonly ExitMeaning[] = [
  'next',
  'branch',
  'received',
  'expired',
  'approved',
  'rejected',
];

const DURATION_UNITS: readonly PlanDurationUnit[] = [
  'minutes',
  'hours',
  'days',
  'weeks',
];

const EVENT_TRIGGERS: readonly PlanEventTrigger[] = ['error', 'timeout'];

const OUTCOME_KINDS: readonly OutcomeKind[] = [
  'completed',
  'rejected',
  'cancelled',
  'expired',
  'other',
];

function toDuration(value: unknown): PlanDuration | undefined {
  if (!isRecord(value) || !isPositiveInteger(value.amount)) {
    return undefined;
  }
  const unit = knownOption({ value: value.unit, options: DURATION_UNITS });
  return unit === undefined ? undefined : { amount: value.amount, unit };
}

function toExit(value: unknown): PlanExit | null {
  if (!isRecord(value) || !isFilledText(value.id)) {
    return null;
  }
  const meaning = knownOption({ value: value.meaning, options: EXIT_MEANINGS });
  if (meaning === undefined) {
    return null;
  }
  return {
    id: value.id,
    meaning,
    label: optionalText(value.label),
    condition: optionalText(value.condition),
    description: optionalText(value.description),
    to: optionalText(value.to),
  };
}

function toEvent(value: unknown): PlanEvent | null {
  if (
    !isRecord(value) ||
    !isFilledText(value.id) ||
    typeof value.label !== 'string'
  ) {
    return null;
  }
  const trigger = knownOption({
    value: value.trigger,
    options: EVENT_TRIGGERS,
  });
  if (trigger === undefined) {
    return null;
  }
  return {
    id: value.id,
    label: value.label,
    trigger,
    interrupting: value.interrupting === true,
    timeout: toDuration(value.timeout),
    to: optionalText(value.to),
  };
}

function toDetail(value: unknown): PlanDetail | null {
  return isRecord(value) &&
    isFilledText(value.label) &&
    isFilledText(value.value)
    ? { label: value.label, value: value.value }
    : null;
}

/** Desfecho lido do armazenamento; `undefined` quando o tipo ou o nome não são legíveis. */
export function parseOutcome(value: unknown): PlanOutcome | undefined {
  if (!isRecord(value) || typeof value.label !== 'string') {
    return undefined;
  }
  const kind = knownOption({ value: value.kind, options: OUTCOME_KINDS });
  return kind === undefined ? undefined : { kind, label: value.label };
}

/** Dados opcionais da etapa: o que vier fora do formato é descartado, sem invalidar a etapa. */
function optionalStepData(value: UnknownRecord): Partial<PlanStep> {
  return {
    description: optionalText(value.description),
    role: optionalText(value.role),
    instructions: optionalText(value.instructions),
    expectedResult: optionalText(value.expectedResult),
    dueIn: toDuration(value.dueIn),
    details: keepValid({ value: value.details, parse: toDetail }),
    fields: parseFields(value.fields),
    events: keepValid({ value: value.events, parse: toEvent }),
    deadline: toDuration(value.deadline),
    duration: toDuration(value.duration),
    until: isTimestamp(value.until) ? value.until : undefined,
    // NOTE: processo interno ilegível fica de fora, e o subprocesso passa a valer como tarefa simples.
    inner: parsePlan(value.inner) ?? undefined,
    outcome: parseOutcome(value.outcome),
  };
}

function isStepId(value: unknown): value is string {
  return isFilledText(value) && !value.includes(STEP_REF_SEPARATOR);
}

function toStep(value: unknown): PlanStep | null {
  if (
    !isRecord(value) ||
    !isStepId(value.id) ||
    typeof value.label !== 'string'
  ) {
    return null;
  }
  const kind = knownOption({ value: value.kind, options: STEP_KINDS });
  const exits = allValid({ value: value.exits, parse: toExit });
  if (kind === undefined || exits === null) {
    return null;
  }
  const defaultExit = exits.find((exit) => exit.id === value.defaultExitId);
  return {
    id: value.id,
    kind,
    label: value.label,
    exits,
    defaultExitId: defaultExit?.id,
    ...optionalStepData(value),
  };
}

interface KnownTargetsParams {
  readonly step: PlanStep;
  readonly ids: ReadonlySet<string>;
}

/** Tira das saídas e das exceções o destino que não é etapa do nível: o caminho passa a terminar ali. */
function withKnownTargets(params: KnownTargetsParams): PlanStep {
  const { step, ids } = params;
  const known = (to: string | undefined): string | undefined =>
    to !== undefined && ids.has(to) ? to : undefined;
  return {
    ...step,
    exits: step.exits.map((exit) => ({ ...exit, to: known(exit.to) })),
    events: step.events?.map((event) => ({ ...event, to: known(event.to) })),
  };
}

/**
 * Lê um roteiro vindo do armazenamento. O que define o caminho é lido à risca: etapa ou saída ilegível, id repetido
 * e início que não é etapa do nível invalidam o roteiro (`null`). O resto é lido campo a campo: dado opcional fora do
 * formato, exceção ilegível e destino inexistente são descartados.
 */
export function parsePlan(value: unknown): ProcessPlan | null {
  if (!isRecord(value)) {
    return null;
  }
  const steps = allValid({ value: value.steps, parse: toStep });
  if (steps === null) {
    return null;
  }
  const ids = new Set(steps.map((step) => step.id));
  const { startId } = value;
  if (typeof startId !== 'string' || !ids.has(startId)) {
    return null;
  }
  return {
    startId,
    steps: steps.map((step) => withKnownTargets({ step, ids })),
  };
}

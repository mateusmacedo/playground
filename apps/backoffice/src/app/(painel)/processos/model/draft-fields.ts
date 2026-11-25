import type {
  BlockData,
  Branch,
  Duration,
  DurationUnit,
  EndOutcome,
  ExceptionTrigger,
  MessageChannel,
  Schedule,
  StartTrigger,
  TimerMode,
} from './blocks';
import {
  isChannel,
  isDateTime,
  isDuration,
  isOutcome,
  isSchedule,
} from './fields';

/** Leitura de um campo: o valor aceito (ou convertido) e se ele precisou de ajuste. */
interface Reading<T> {
  readonly value: T | undefined;
  readonly adjusted: boolean;
}

const ABSENT: Reading<never> = { value: undefined, adjusted: false };
const DROPPED: Reading<never> = { value: undefined, adjusted: true };

function kept<T>(value: T): Reading<T> {
  return { value, adjusted: false };
}

function normalized(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

interface LegacyUnit {
  readonly pattern: RegExp;
  readonly unit: DurationUnit;
}

const LEGACY_UNITS: readonly LegacyUnit[] = [
  { pattern: /^min(uto)?s?$/, unit: 'minutes' },
  { pattern: /^h(ora)?s?$/, unit: 'hours' },
  { pattern: /^dias?$/, unit: 'days' },
  { pattern: /^semanas?$/, unit: 'weeks' },
];

/** Converte o texto livre da versão 1 ("48 horas", "2 dias") em duração; o que não casar fica de fora. */
export function legacyDuration(text: string): Duration | undefined {
  const match = /^(\d+)\s*([a-z]+)$/.exec(normalized(text));
  if (!match) {
    return undefined;
  }
  const word = match[2] ?? '';
  const unit = LEGACY_UNITS.find((entry) => entry.pattern.test(word))?.unit;
  if (unit === undefined) {
    return undefined;
  }
  const duration: Duration = { amount: Number(match[1]), unit };
  return isDuration(duration) ? duration : undefined;
}

const LEGACY_CHANNELS: Readonly<Record<string, MessageChannel>> = {
  email: 'email',
  'e-mail': 'email',
  sms: 'sms',
  whatsapp: 'whatsapp',
  notificacao: 'in-app',
  'notificacao no sistema': 'in-app',
};

const LEGACY_OUTCOMES: Readonly<Record<string, EndOutcome>> = {
  concluido: 'completed',
  recusado: 'rejected',
  cancelado: 'cancelled',
  expirado: 'expired',
};

function readText(value: unknown): Reading<string> {
  if (value === undefined) {
    return ABSENT;
  }
  return typeof value === 'string' ? kept(value) : DROPPED;
}

function readDuration(value: unknown): Reading<Duration> {
  if (value === undefined || value === '') {
    return value === '' ? DROPPED : ABSENT;
  }
  if (isDuration(value)) {
    return kept(value);
  }
  const converted =
    typeof value === 'string' ? legacyDuration(value) : undefined;
  return { value: converted, adjusted: true };
}

function isStartTrigger(value: unknown): value is StartTrigger {
  return value === 'manual' || value === 'message' || value === 'schedule';
}

function isTimerMode(value: unknown): value is TimerMode {
  return value === 'duration' || value === 'until';
}

function isExceptionTrigger(value: unknown): value is ExceptionTrigger {
  return value === 'error' || value === 'timeout';
}

interface CheckedParams<T> {
  readonly value: unknown;
  readonly isValid: (value: unknown) => value is T;
}

/** Campo com formato próprio (agendamento, data e horário, opção de lista): vale se o verificador aceitar. */
function readChecked<T>(params: CheckedParams<T>): Reading<T> {
  const { value, isValid } = params;
  if (value === undefined || value === '') {
    return value === '' ? DROPPED : ABSENT;
  }
  return isValid(value) ? kept(value) : DROPPED;
}

function readBoolean(value: unknown): Reading<boolean> {
  if (value === undefined) {
    return ABSENT;
  }
  return typeof value === 'boolean' ? kept(value) : DROPPED;
}

function readChannel(value: unknown): Reading<MessageChannel> {
  if (value === undefined || isChannel(value)) {
    return value === undefined ? ABSENT : kept(value);
  }
  const known =
    typeof value === 'string' ? LEGACY_CHANNELS[normalized(value)] : undefined;
  return { value: known, adjusted: true };
}

interface OutcomeReading {
  readonly outcome: Reading<EndOutcome>;
  readonly outcomeLabel: Reading<string>;
}

function readOutcome(raw: Record<string, unknown>): OutcomeReading {
  const value = raw.outcome;
  const label = readText(raw.outcomeLabel);
  if (value === undefined || isOutcome(value)) {
    const outcome = value === undefined ? ABSENT : kept(value);
    return { outcome, outcomeLabel: label };
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return { outcome: DROPPED, outcomeLabel: label };
  }
  const known = LEGACY_OUTCOMES[normalized(value)];
  if (known !== undefined) {
    return { outcome: { value: known, adjusted: true }, outcomeLabel: label };
  }
  return {
    outcome: { value: 'other', adjusted: true },
    outcomeLabel: kept(value.trim()),
  };
}

function isBranch(value: unknown): value is Branch {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const branch: { id?: unknown; label?: unknown } = value;
  return typeof branch.id === 'string' && typeof branch.label === 'string';
}

function readBranches(value: unknown): Reading<readonly Branch[]> {
  if (value === undefined) {
    return ABSENT;
  }
  if (!Array.isArray(value)) {
    return DROPPED;
  }
  const branches = value.filter(isBranch);
  return { value: branches, adjusted: branches.length !== value.length };
}

interface DefaultBranchParams {
  readonly value: unknown;
  readonly branches: readonly Branch[] | undefined;
}

function readDefaultBranch(params: DefaultBranchParams): Reading<string> {
  const { value, branches } = params;
  if (value === undefined) {
    return ABSENT;
  }
  const exists = (branches ?? []).some((branch) => branch.id === value);
  return exists && typeof value === 'string' ? kept(value) : DROPPED;
}

export interface SanitizeParams {
  readonly raw: Record<string, unknown>;
  readonly label: string;
}

export interface SanitizedData {
  readonly data: BlockData;
  readonly adjusted: number;
}

/**
 * Dados do bloco lidos de um rascunho: cada campo passa pela mesma regra da tela, e o que não for válido sai. Valores
 * em texto da versão 1 (prazos, durações, desfecho, canal) são convertidos quando reconhecíveis. Devolve também
 * quantos campos foram ajustados, para a tela avisar.
 */
export function sanitizeBlockData({
  raw,
  label,
}: SanitizeParams): SanitizedData {
  let adjusted = 0;
  function take<T>(reading: Reading<T>): T | undefined {
    if (reading.adjusted) {
      adjusted += 1;
    }
    return reading.value;
  }
  const branches = take(readBranches(raw.branches));
  const outcome = readOutcome(raw);
  const data: BlockData = {
    label,
    description: take(readText(raw.description)),
    laneId: take(readText(raw.laneId)),
    branches,
    defaultBranchId: take(
      readDefaultBranch({ value: raw.defaultBranchId, branches }),
    ),
    trigger: take(readChecked({ value: raw.trigger, isValid: isStartTrigger })),
    schedule: take(
      readChecked<Schedule>({ value: raw.schedule, isValid: isSchedule }),
    ),
    triggerMessage: take(readText(raw.triggerMessage)),
    role: take(readText(raw.role)),
    instructions: take(readText(raw.instructions)),
    expectedResult: take(readText(raw.expectedResult)),
    dueIn: take(readDuration(raw.dueIn)),
    system: take(readText(raw.system)),
    operation: take(readText(raw.operation)),
    inputs: take(readText(raw.inputs)),
    outputs: take(readText(raw.outputs)),
    recipient: take(readText(raw.recipient)),
    channel: take(readChannel(raw.channel)),
    content: take(readText(raw.content)),
    eventName: take(readText(raw.eventName)),
    deadline: take(readDuration(raw.deadline)),
    timerMode: take(
      readChecked({ value: raw.timerMode, isValid: isTimerMode }),
    ),
    duration: take(readDuration(raw.duration)),
    until: take(readChecked({ value: raw.until, isValid: isDateTime })),
    pairId: take(readText(raw.pairId)),
    exceptionTrigger: take(
      readChecked({ value: raw.exceptionTrigger, isValid: isExceptionTrigger }),
    ),
    timeout: take(readDuration(raw.timeout)),
    interrupting: take(readBoolean(raw.interrupting)),
    goal: take(readText(raw.goal)),
    outcome: take(outcome.outcome),
    outcomeLabel: take(outcome.outcomeLabel),
  };
  return { data: withoutEmpty(data), adjusted };
}

/** Tira as chaves sem valor, para o rascunho regravado ficar igual ao que a tela produz. */
function withoutEmpty(data: BlockData): BlockData {
  let result: BlockData = { label: data.label };
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result = { ...result, [key]: value };
    }
  }
  return result;
}

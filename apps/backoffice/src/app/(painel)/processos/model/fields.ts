import type {
  Duration,
  DurationUnit,
  EndOutcome,
  MessageChannel,
  Schedule,
  ScheduleRecurrence,
} from './blocks';

export interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface UnitText {
  readonly unit: DurationUnit;
  readonly singular: string;
  readonly plural: string;
}

export const DURATION_UNITS: readonly UnitText[] = [
  { unit: 'minutes', singular: 'minuto', plural: 'minutos' },
  { unit: 'hours', singular: 'hora', plural: 'horas' },
  { unit: 'days', singular: 'dia', plural: 'dias' },
  { unit: 'weeks', singular: 'semana', plural: 'semanas' },
];

/** Maior quantidade aceita numa duração: um teto de bom senso, não uma regra de negócio. */
export const MAX_DURATION_AMOUNT = 999;

export const DEFAULT_DURATION: Duration = { amount: 1, unit: 'hours' };

export const CHANNELS: readonly Option<MessageChannel>[] = [
  { value: 'email', label: 'E-mail' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'in-app', label: 'Notificação no sistema' },
];

export const OUTCOMES: readonly Option<EndOutcome>[] = [
  { value: 'completed', label: 'Concluído' },
  { value: 'rejected', label: 'Recusado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'expired', label: 'Expirado' },
  { value: 'other', label: 'Outro' },
];

export const RECURRENCES: readonly Option<ScheduleRecurrence>[] = [
  { value: 'once', label: 'Uma vez' },
  { value: 'daily', label: 'Todos os dias' },
  { value: 'weekly', label: 'Toda semana' },
  { value: 'monthly', label: 'Todo mês' },
];

export const WEEKDAYS: readonly string[] = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

/** Último dia do mês que todo mês tem; depois dele, só a opção "último dia". */
export const LAST_COMMON_MONTH_DAY = 28;

export const DEFAULT_SCHEDULE: Schedule = {
  recurrence: 'daily',
  time: '09:00',
};

interface RangeParams {
  readonly value: unknown;
  readonly min: number;
  readonly max: number;
}

function isIntegerBetween({ value, min, max }: RangeParams): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isDuration(value: unknown): value is Duration {
  if (!isRecord(value)) {
    return false;
  }
  const { amount, unit } = value;
  const knownUnit = DURATION_UNITS.some((entry) => entry.unit === unit);
  return (
    knownUnit &&
    isIntegerBetween({ value: amount, min: 1, max: MAX_DURATION_AMOUNT })
  );
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME.test(value);
}

/** Data de calendário real: rejeita 31/02 e afins. */
export function isDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = DATE.exec(value);
  if (!match) {
    return false;
  }
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

/** Data e horário locais `AAAA-MM-DDTHH:MM`, como o campo `datetime-local` devolve. */
export function isDateTime(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const [date, time] = value.split('T');
  return isDate(date) && isTime(time);
}

export function isSchedule(value: unknown): value is Schedule {
  if (!isRecord(value)) {
    return false;
  }
  const schedule = value;
  if (!isTime(schedule.time)) {
    return false;
  }
  switch (schedule.recurrence) {
    case 'once':
      return isDate(schedule.date);
    case 'daily':
      return true;
    case 'weekly':
      return isIntegerBetween({ value: schedule.weekday, min: 0, max: 6 });
    case 'monthly':
      return (
        schedule.monthDay === 'last' ||
        isIntegerBetween({
          value: schedule.monthDay,
          min: 1,
          max: LAST_COMMON_MONTH_DAY,
        })
      );
    default:
      return false;
  }
}

export function isChannel(value: unknown): value is MessageChannel {
  return CHANNELS.some((option) => option.value === value);
}

export function isOutcome(value: unknown): value is EndOutcome {
  return OUTCOMES.some((option) => option.value === value);
}

export function formatDuration(duration: Duration): string {
  const text = DURATION_UNITS.find((entry) => entry.unit === duration.unit);
  const word = duration.amount === 1 ? text?.singular : text?.plural;
  return `${duration.amount} ${word ?? ''}`.trim();
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function formatDateTime(value: string): string {
  const [date = '', time = ''] = value.split('T');
  return `${formatDate(date)} às ${time}`;
}

export function formatSchedule(schedule: Schedule): string {
  const at = `às ${schedule.time}`;
  switch (schedule.recurrence) {
    case 'once':
      return `Uma vez, em ${formatDate(schedule.date ?? '')} ${at}`;
    case 'daily':
      return `Todos os dias ${at}`;
    case 'weekly':
      return `Toda ${WEEKDAYS[schedule.weekday ?? 0]} ${at}`;
    case 'monthly':
      return schedule.monthDay === 'last'
        ? `No último dia do mês ${at}`
        : `Todo dia ${schedule.monthDay} ${at}`;
  }
}

export function channelLabel(channel: MessageChannel): string {
  return CHANNELS.find((option) => option.value === channel)?.label ?? '';
}

/** Nome do desfecho: o da lista ou, em "Outro", o que o usuário deu. */
export interface OutcomeTextParams {
  readonly outcome?: EndOutcome;
  readonly outcomeLabel?: string;
}

export function outcomeText(params: OutcomeTextParams): string {
  const { outcome, outcomeLabel } = params;
  if (outcome === 'other') {
    return (outcomeLabel ?? '').trim();
  }
  return OUTCOMES.find((option) => option.value === outcome)?.label ?? '';
}

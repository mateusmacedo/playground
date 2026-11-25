import {
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CInputGroup,
} from '@coreui/react';
import { useId, useState } from 'react';

import type {
  Duration,
  DurationUnit,
  MonthDay,
  Schedule,
  ScheduleRecurrence,
} from '../model/blocks';
import {
  DEFAULT_DURATION,
  DURATION_UNITS,
  isDate,
  isTime,
  LAST_COMMON_MONTH_DAY,
  MAX_DURATION_AMOUNT,
  RECURRENCES,
  WEEKDAYS,
} from '../model/fields';

function isUnit(value: string): value is DurationUnit {
  return DURATION_UNITS.some((entry) => entry.unit === value);
}

function parseAmount(text: string): number | null {
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const amount = Number(text);
  return amount >= 1 && amount <= MAX_DURATION_AMOUNT ? amount : null;
}

export interface DurationInputProps {
  readonly label: string;
  readonly value: Duration;
  readonly onChange: (value: Duration) => void;
}

/**
 * Duração como quantidade inteira e unidade de relógio. O que o usuário digita fica no campo até virar um número
 * válido; só então chega ao processo, então o processo nunca guarda uma duração inválida.
 */
export function DurationInput({
  label,
  value,
  onChange,
}: Readonly<DurationInputProps>) {
  const amountId = useId();
  const feedbackId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value.amount);
  const invalid = draft !== null && parseAmount(draft) === null;

  return (
    <div className="mb-3">
      <CFormLabel htmlFor={amountId}>{label}</CFormLabel>
      <CInputGroup>
        <CFormInput
          id={amountId}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_DURATION_AMOUNT}
          step={1}
          value={shown}
          invalid={invalid}
          aria-describedby={invalid ? feedbackId : undefined}
          onChange={(event) => {
            const amount = parseAmount(event.target.value);
            if (amount === null) {
              setDraft(event.target.value);
              return;
            }
            setDraft(null);
            onChange({ ...value, amount });
          }}
          onBlur={() => setDraft(null)}
        />
        <CFormSelect
          aria-label={`Unidade de ${label.toLowerCase()}`}
          value={value.unit}
          onChange={(event) => {
            if (isUnit(event.target.value)) {
              onChange({ ...value, unit: event.target.value });
            }
          }}
        >
          {DURATION_UNITS.map((entry) => (
            <option key={entry.unit} value={entry.unit}>
              {entry.plural}
            </option>
          ))}
        </CFormSelect>
      </CInputGroup>
      {invalid ? (
        <CFormFeedback invalid id={feedbackId} className="d-block">
          Use um número inteiro de 1 a {MAX_DURATION_AMOUNT}.
        </CFormFeedback>
      ) : null}
    </div>
  );
}

export interface OptionalDurationProps {
  /** Texto da chave, como "Tem prazo". */
  readonly toggleLabel: string;
  readonly label: string;
  readonly value: Duration | undefined;
  readonly onChange: (value: Duration | undefined) => void;
}

/** Duração que pode não existir: a chave liga com uma hora e desliga apagando o valor. */
export function OptionalDuration({
  toggleLabel,
  label,
  value,
  onChange,
}: Readonly<OptionalDurationProps>) {
  const switchId = useId();
  return (
    <>
      <CFormSwitch
        id={switchId}
        className="mb-2"
        label={toggleLabel}
        checked={value !== undefined}
        onChange={(event) =>
          onChange(event.target.checked ? DEFAULT_DURATION : undefined)
        }
      />
      {value === undefined ? null : (
        <DurationInput label={label} value={value} onChange={onChange} />
      )}
    </>
  );
}

function isRecurrence(value: string): value is ScheduleRecurrence {
  return RECURRENCES.some((option) => option.value === value);
}

function todayText(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

interface RecurrenceChangeParams {
  readonly schedule: Schedule;
  readonly recurrence: ScheduleRecurrence;
}

/** Agendamento ao trocar a recorrência: mantém o horário e põe o dia que a recorrência nova pede. */
function withRecurrence({
  schedule,
  recurrence,
}: RecurrenceChangeParams): Schedule {
  const base = { recurrence, time: schedule.time };
  switch (recurrence) {
    case 'once':
      return { ...base, date: todayText() };
    case 'weekly':
      return { ...base, weekday: 1 };
    case 'monthly':
      return { ...base, monthDay: 1 };
    case 'daily':
      return base;
  }
}

function monthDayOf(value: string): MonthDay {
  return value === 'last' ? 'last' : Number(value);
}

export interface ScheduleInputProps {
  readonly value: Schedule;
  readonly onChange: (value: Schedule) => void;
}

/** Agendamento por recorrência e horário; cada recorrência mostra só o dia que ela usa. */
export function ScheduleInput({
  value,
  onChange,
}: Readonly<ScheduleInputProps>) {
  const recurrenceId = useId();
  const timeId = useId();
  const dayId = useId();
  const monthDays = Array.from(
    { length: LAST_COMMON_MONTH_DAY },
    (_, index) => index + 1,
  );

  return (
    <fieldset className="mb-3">
      <legend className="fs-6">Agendamento</legend>
      <CFormSelect
        id={recurrenceId}
        label="Repetição"
        className="mb-2"
        value={value.recurrence}
        onChange={(event) => {
          if (isRecurrence(event.target.value)) {
            onChange(
              withRecurrence({
                schedule: value,
                recurrence: event.target.value,
              }),
            );
          }
        }}
      >
        {RECURRENCES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </CFormSelect>
      {value.recurrence === 'once' ? (
        <CFormInput
          id={dayId}
          type="date"
          label="Data"
          className="mb-2"
          required
          value={value.date ?? ''}
          onChange={(event) => {
            if (isDate(event.target.value)) {
              onChange({ ...value, date: event.target.value });
            }
          }}
        />
      ) : null}
      {value.recurrence === 'weekly' ? (
        <CFormSelect
          id={dayId}
          label="Dia da semana"
          className="mb-2"
          value={String(value.weekday ?? 1)}
          onChange={(event) =>
            onChange({ ...value, weekday: Number(event.target.value) })
          }
        >
          {WEEKDAYS.map((day, index) => (
            <option key={day} value={index}>
              {day}
            </option>
          ))}
        </CFormSelect>
      ) : null}
      {value.recurrence === 'monthly' ? (
        <CFormSelect
          id={dayId}
          label="Dia do mês"
          className="mb-2"
          value={String(value.monthDay ?? 1)}
          onChange={(event) =>
            onChange({ ...value, monthDay: monthDayOf(event.target.value) })
          }
        >
          {monthDays.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
          <option value="last">Último dia do mês</option>
        </CFormSelect>
      ) : null}
      <CFormInput
        id={timeId}
        type="time"
        label="Horário"
        required
        value={value.time}
        onChange={(event) => {
          if (isTime(event.target.value)) {
            onChange({ ...value, time: event.target.value });
          }
        }}
      />
    </fieldset>
  );
}

import { CFormCheck, CFormInput } from '@coreui/react';
import { useId } from 'react';

import type {
  BlockData,
  ExceptionTrigger,
  StartTrigger,
  TimerMode,
} from '../model/blocks';
import { type BlockField, FIELD_LABEL } from '../model/conversion';
import {
  DEFAULT_DURATION,
  DEFAULT_SCHEDULE,
  isDateTime,
} from '../model/fields';
import {
  Choice,
  type ChoiceOption,
  type FieldProps,
  RequiredDuration,
  TextField,
} from './field-controls';
import { OptionalDuration, ScheduleInput } from './time-inputs';

/** Campos de início e de evento, desenhados por `EventField`. */
export const EVENT_FIELDS = new Set<BlockField>([
  'trigger',
  'schedule',
  'triggerMessage',
  'deadline',
  'timerMode',
  'duration',
  'until',
  'exceptionTrigger',
  'timeout',
  'interrupting',
]);

const TRIGGERS: readonly ChoiceOption<StartTrigger>[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'message', label: 'Por mensagem' },
  { value: 'schedule', label: 'Por agendamento' },
];

const TIMER_MODES: readonly ChoiceOption<TimerMode>[] = [
  { value: 'duration', label: 'Por uma duração' },
  { value: 'until', label: 'Até data e horário' },
];

const EXCEPTION_TRIGGERS: readonly ChoiceOption<ExceptionTrigger>[] = [
  { value: 'error', label: 'Erro técnico' },
  { value: 'timeout', label: 'Tempo esgotado' },
];

/** Trocar o gatilho grava junto o dado que ele pede e apaga o do gatilho anterior. */
export function triggerPatch(trigger: StartTrigger): Partial<BlockData> {
  switch (trigger) {
    case 'schedule':
      return { trigger, schedule: DEFAULT_SCHEDULE, triggerMessage: undefined };
    case 'message':
      return { trigger, schedule: undefined, triggerMessage: '' };
    case 'manual':
      return { trigger, schedule: undefined, triggerMessage: undefined };
  }
}

/** Amanhã às 09:00 no horário local, ponto de partida do modo "até data e horário". */
function tomorrowMorning(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}T09:00`;
}

/** Trocar o modo do temporizador deixa só o dado do modo novo. */
export function timerModePatch(timerMode: TimerMode): Partial<BlockData> {
  return timerMode === 'until'
    ? { timerMode, duration: undefined, until: tomorrowMorning() }
    : { timerMode, duration: DEFAULT_DURATION, until: undefined };
}

/** Tempo esgotado exige tempo limite; erro técnico não tem um. */
export function exceptionPatch(
  exceptionTrigger: ExceptionTrigger,
): Partial<BlockData> {
  return exceptionTrigger === 'timeout'
    ? { exceptionTrigger, timeout: DEFAULT_DURATION }
    : { exceptionTrigger, timeout: undefined };
}

function UntilField({ node, update }: Readonly<FieldProps>) {
  const id = useId();
  if (node.data.timerMode !== 'until') {
    return null;
  }
  return (
    <CFormInput
      id={id}
      type="datetime-local"
      label={FIELD_LABEL.until}
      className="mb-3"
      required
      value={node.data.until ?? ''}
      onChange={(event) => {
        if (isDateTime(event.target.value)) {
          update({ until: event.target.value });
        }
      }}
    />
  );
}

function InterruptingField({ node, update }: Readonly<FieldProps>) {
  const id = useId();
  return (
    <CFormCheck
      id={id}
      className="mb-3"
      label="Interrompe a atividade (sem marcar, abre um caminho a mais)"
      checked={node.data.interrupting !== false}
      onChange={(event) => update({ interrupting: event.target.checked })}
    />
  );
}

function StartField(props: Readonly<FieldProps>) {
  const { field, node, update } = props;
  const { data } = node;
  if (field === 'trigger') {
    return (
      <Choice
        label={FIELD_LABEL.trigger}
        value={data.trigger ?? 'manual'}
        options={TRIGGERS}
        onChange={(trigger) => update(triggerPatch(trigger))}
      />
    );
  }
  if (field === 'schedule') {
    return data.trigger === 'schedule' ? (
      <ScheduleInput
        value={data.schedule ?? DEFAULT_SCHEDULE}
        onChange={(schedule) => update({ schedule })}
      />
    ) : null;
  }
  return data.trigger === 'message' ? <TextField {...props} /> : null;
}

function TimerField(props: Readonly<FieldProps>) {
  const { field, node, update } = props;
  const { data } = node;
  if (field === 'timerMode') {
    return (
      <Choice
        label={FIELD_LABEL.timerMode}
        value={data.timerMode ?? 'duration'}
        options={TIMER_MODES}
        onChange={(timerMode) => update(timerModePatch(timerMode))}
      />
    );
  }
  if (field === 'until') {
    return <UntilField {...props} />;
  }
  return data.timerMode === 'until' ? null : (
    <RequiredDuration
      label={FIELD_LABEL.duration}
      value={data.duration}
      onChange={(duration) => update({ duration })}
    />
  );
}

function ExceptionField(props: Readonly<FieldProps>) {
  const { field, node, update } = props;
  const { data } = node;
  if (field === 'exceptionTrigger') {
    return (
      <Choice
        label={FIELD_LABEL.exceptionTrigger}
        value={data.exceptionTrigger ?? 'error'}
        options={EXCEPTION_TRIGGERS}
        onChange={(trigger) => update(exceptionPatch(trigger))}
      />
    );
  }
  if (field === 'interrupting') {
    return <InterruptingField {...props} />;
  }
  return data.exceptionTrigger === 'timeout' ? (
    <RequiredDuration
      label={FIELD_LABEL.timeout}
      value={data.timeout}
      onChange={(timeout) => update({ timeout })}
    />
  ) : null;
}

/** Campos de início, espera, temporizador e exceção, cada um com o controle de relógio que o propósito pede. */
export function EventField(props: Readonly<FieldProps>) {
  const { field, node, update } = props;
  switch (field) {
    case 'trigger':
    case 'schedule':
    case 'triggerMessage':
      return <StartField {...props} />;
    case 'deadline':
      return (
        <OptionalDuration
          toggleLabel="Tem prazo (abre a saída Prazo expirado)"
          label={FIELD_LABEL.deadline}
          value={node.data.deadline}
          onChange={(deadline) => update({ deadline })}
        />
      );
    case 'timerMode':
    case 'duration':
    case 'until':
      return <TimerField {...props} />;
    default:
      return <ExceptionField {...props} />;
  }
}

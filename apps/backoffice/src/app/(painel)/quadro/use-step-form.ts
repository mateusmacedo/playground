import { useState } from 'react';

import type { ActiveStep } from '@/shared/process/engine-active';
import { eventName, exitName } from '@/shared/process/engine-kinds';
import type { FieldValues } from '@/shared/process/fields';
import type { PlanEvent, PlanExit } from '@/shared/process/plan';

import { stepName } from './model/process-text';
import type { AdvanceRequest, CardProcessActions } from './use-card-process';

export interface FieldChange {
  readonly fieldId: string;
  /** O texto digitado ou a marca da caixa. */
  readonly value: string | boolean;
}

/** O que a pessoa preencheu numa etapa ativa e as ações que o tipo da etapa aceita. */
export interface StepForm {
  /** Só os campos em que a pessoa mexeu. */
  readonly values: FieldValues;
  readonly note: string;
  /** Saídas marcadas, na etapa que aceita mais de uma. */
  readonly picked: readonly string[];
  /** Por que o processo recusou a última ação; some quando a seguinte é aceita. */
  readonly refusal: string | undefined;
  readonly setValue: (change: FieldChange) => void;
  readonly setNote: (note: string) => void;
  readonly togglePicked: (exitId: string) => void;
  readonly complete: () => void;
  /** Segue pelas saídas dadas: uma, ou as marcadas na etapa que aceita várias. */
  readonly choose: (exits: readonly PlanExit[]) => void;
  readonly raise: (event: PlanEvent) => void;
}

export interface UseStepFormParams {
  readonly active: ActiveStep;
  readonly actions: Pick<CardProcessActions, 'advance'>;
}

/**
 * O formulário de uma etapa ativa: os campos, a observação e os caminhos marcados ficam aqui até a ação, e a recusa do
 * processo volta como texto, para aparecer junto da etapa.
 */
export function useStepForm(params: UseStepFormParams): StepForm {
  const { active, actions } = params;
  const tokenId = active.token.id;
  const name = stepName(active.step.label);
  const [values, setValues] = useState<FieldValues>({});
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [refusal, setRefusal] = useState<string>();

  function send(request: AdvanceRequest) {
    const message = actions.advance(request);
    setRefusal(message);
    if (message === undefined) {
      // NOTE: a exceção que não interrompe deixa a etapa na tela; a observação dela já foi para a trilha.
      setNote('');
    }
  }

  return {
    values,
    note,
    picked,
    refusal,
    setNote,
    setValue: (change) =>
      setValues((current) => ({ ...current, [change.fieldId]: change.value })),
    togglePicked: (exitId) =>
      setPicked((current) =>
        current.includes(exitId)
          ? current.filter((id) => id !== exitId)
          : [...current, exitId],
      ),
    complete: () =>
      send({
        action: { kind: 'complete', tokenId, note, values },
        announcement: `Etapa ${name} concluída.`,
      }),
    choose: (exits) =>
      send({
        action: {
          kind: 'choose',
          tokenId,
          exitIds: exits.map((exit) => exit.id),
          note,
          values,
        },
        announcement: `Etapa ${name}: ${exits.map(exitName).join(', ')}.`,
      }),
    raise: (event) =>
      send({
        action: { kind: 'raise', tokenId, eventId: event.id, note },
        announcement: `Exceção ${eventName(event)} registrada na etapa ${name}.`,
      }),
  };
}

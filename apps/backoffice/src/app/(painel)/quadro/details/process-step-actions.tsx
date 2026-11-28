import { CButton, CFormTextarea } from '@coreui/react';
import { useId } from 'react';

import type { ActiveEvent, ActiveStep } from '@/shared/process/engine-active';
import { exitName } from '@/shared/process/engine-kinds';
import type { ExitMeaning, PlanExit } from '@/shared/process/plan';

import { CheckField } from '@/shared/ui/check-field';
import { choiceText, raiseText } from '../model/process-text';
import type { CardProcessActions } from '../use-card-process';
import { type StepForm, useStepForm } from '../use-step-form';
import { ProcessMoment } from './process-moment';
import { ProcessStepFields } from './process-step-fields';

/** Cor do botão de cada saída: a aprovação e a rejeição têm cores próprias, e as outras seguem a ação principal. */
const CHOICE_COLOR: Readonly<Partial<Record<ExitMeaning, string>>> = {
  approved: 'success',
  rejected: 'danger',
};

interface ChoiceHintsProps {
  readonly choices: readonly PlanExit[];
}

/** Quando seguir por cada caminho, para os caminhos que dizem a condição ou trazem uma descrição. */
function ChoiceHints({ choices }: Readonly<ChoiceHintsProps>) {
  const explained = choices.filter(
    (exit) => exit.condition ?? exit.description,
  );
  if (explained.length === 0) {
    return null;
  }
  return (
    <ul className="small text-body-secondary mb-0 ps-3">
      {explained.map((exit) => (
        <li key={exit.id}>
          {exitName(exit)}: {exit.condition ?? exit.description}
        </li>
      ))}
    </ul>
  );
}

interface ChoiceButtonsProps {
  readonly choices: readonly PlanExit[];
  readonly form: StepForm;
}

/** Um botão por saída, na etapa que segue por uma só: decisão, aprovação e espera por evento. */
function ChoiceButtons({ choices, form }: Readonly<ChoiceButtonsProps>) {
  return (
    <>
      {choices.map((exit) => (
        <CButton
          key={exit.id}
          type="button"
          color={CHOICE_COLOR[exit.meaning] ?? 'primary'}
          size="sm"
          onClick={() => form.choose([exit])}
        >
          {choiceText(exit)}
        </CButton>
      ))}
    </>
  );
}

/** Os caminhos da decisão inclusiva, para marcar um ou mais antes de seguir. */
function ChoiceChecks({ choices, form }: Readonly<ChoiceButtonsProps>) {
  const legendId = useId();
  const picked = choices.filter((exit) => form.picked.includes(exit.id));

  return (
    <fieldset aria-labelledby={legendId} className="d-grid gap-1">
      <legend id={legendId} className="fs-6 mb-0">
        Caminhos a seguir
      </legend>
      {choices.map((exit) => (
        <CheckField
          key={exit.id}
          id={`${legendId}-${exit.id}`}
          label={exitName(exit)}
          checked={form.picked.includes(exit.id)}
          onChange={() => form.togglePicked(exit.id)}
        />
      ))}
      <div>
        <CButton
          type="button"
          color="primary"
          size="sm"
          onClick={() => form.choose(picked)}
        >
          Seguir pelos caminhos marcados
        </CButton>
      </div>
    </fieldset>
  );
}

interface RaiseButtonsProps {
  readonly events: readonly ActiveEvent[];
  readonly form: StepForm;
}

/** As exceções que a etapa aceita, cada uma com o efeito sobre a etapa e, quando é por tempo, a hora em que vence. */
function RaiseButtons({ events, form }: Readonly<RaiseButtonsProps>) {
  return (
    <ul className="list-unstyled d-grid gap-1 mb-0">
      {events.map(({ event, dueAt }) => (
        <li key={event.id}>
          <CButton
            type="button"
            color="warning"
            variant="outline"
            size="sm"
            onClick={() => form.raise(event)}
          >
            {raiseText(event)}
          </CButton>
          {dueAt ? (
            <span className="small text-body-secondary ms-2">
              O tempo se esgota em <ProcessMoment at={dueAt} />
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export interface ProcessStepActionsProps {
  readonly active: ActiveStep;
  readonly actions: Pick<CardProcessActions, 'advance'>;
}

/**
 * O que dá para fazer numa etapa ativa: preencher os campos, escrever a observação e agir conforme o tipo da etapa
 * (concluir, escolher o caminho, aprovar ou rejeitar, registrar o evento ou a exceção). O que o processo recusa aparece
 * aqui, junto da etapa.
 */
export function ProcessStepActions({
  active,
  actions,
}: Readonly<ProcessStepActionsProps>) {
  const form = useStepForm({ active, actions });
  const noteId = useId();
  const { step, resolution, choices, multiple, events } = active;
  const fields = step.fields ?? [];

  return (
    <div className="d-grid gap-2">
      {resolution && fields.length > 0 ? (
        <ProcessStepFields
          fields={fields}
          values={form.values}
          onChange={form.setValue}
        />
      ) : null}
      <CFormTextarea
        id={noteId}
        label="Observação"
        text={
          step.kind === 'approval' ? 'Obrigatória para rejeitar.' : undefined
        }
        rows={2}
        value={form.note}
        onChange={(event) => form.setNote(event.target.value)}
      />
      <ChoiceHints choices={choices} />
      {multiple ? <ChoiceChecks choices={choices} form={form} /> : null}
      {form.refusal ? (
        <p role="alert" className="small text-danger mb-0">
          {form.refusal}
        </p>
      ) : null}
      <div className="d-flex flex-wrap gap-2">
        {resolution === 'complete' ? (
          <CButton
            type="button"
            color="primary"
            size="sm"
            onClick={form.complete}
          >
            Concluir etapa
          </CButton>
        ) : null}
        {multiple ? null : <ChoiceButtons choices={choices} form={form} />}
      </div>
      {events.length > 0 ? <RaiseButtons events={events} form={form} /> : null}
    </div>
  );
}

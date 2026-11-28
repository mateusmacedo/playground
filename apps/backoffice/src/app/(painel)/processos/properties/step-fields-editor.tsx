import { cilPlus, cilTrash } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormInput, CFormSelect, CFormTextarea } from '@coreui/react';
import { useId } from 'react';

import { CheckField } from '@/shared/ui/check-field';

import { FIELD_LABEL } from '../model/conversion';
import {
  FIELD_TYPE_OPTIONS,
  type StepFieldPatch,
  stepFieldName,
} from '../model/step-fields';
import {
  type FieldNameProblem,
  type StepFieldProblems,
  stepFieldProblems,
} from '../model/validation-step-fields';
import type { ProcessNode } from '../process-graph';
import type { StepFieldCommands } from './panel-commands';

const NAME_PROBLEM_TEXT: Readonly<Record<FieldNameProblem, string>> = {
  blank: 'Dê um nome ao campo.',
  repeated: 'Já existe um campo com este nome.',
};

/** Cada linha do texto é uma opção; as linhas em branco ficam enquanto se digita e saem quando o roteiro é montado. */
const OPTION_SEPARATOR = '\n';

interface StepFieldRowProps {
  readonly nodeId: string;
  readonly problems: StepFieldProblems;
  readonly commands: StepFieldCommands;
}

function StepFieldRow({
  nodeId,
  problems,
  commands,
}: Readonly<StepFieldRowProps>) {
  const requiredId = useId();
  const { field, position } = problems;
  const name = stepFieldName({ field, position });
  const nameProblem =
    problems.name === null ? undefined : NAME_PROBLEM_TEXT[problems.name];
  const update = (patch: StepFieldPatch) =>
    commands.updateStepField({ nodeId, fieldId: field.id, patch });
  return (
    <li>
      <div className="d-flex gap-2">
        <CFormInput
          size="sm"
          aria-label={`Nome do campo ${position}`}
          invalid={nameProblem !== undefined}
          feedbackInvalid={nameProblem}
          value={field.label}
          onChange={(event) => update({ label: event.target.value })}
        />
        <CButton
          color="danger"
          variant="ghost"
          size="sm"
          aria-label={`Remover o campo ${name}`}
          onClick={() =>
            commands.removeStepField({ nodeId, fieldId: field.id })
          }
        >
          <CIcon icon={cilTrash} aria-hidden="true" />
        </CButton>
      </div>
      <CFormSelect
        size="sm"
        className="mt-1"
        aria-label={`Tipo do campo ${name}`}
        value={field.type}
        onChange={(event) => {
          const chosen = FIELD_TYPE_OPTIONS.find(
            (option) => option.value === event.target.value,
          );
          if (chosen) {
            update({ type: chosen.value });
          }
        }}
      >
        {FIELD_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </CFormSelect>
      {field.type === 'choice' ? (
        <CFormTextarea
          className="form-control-sm mt-1"
          rows={3}
          aria-label={`Opções do campo ${name}`}
          placeholder="Uma opção por linha"
          invalid={problems.lacksOptions}
          feedbackInvalid={
            problems.lacksOptions ? 'Escreva ao menos uma opção.' : undefined
          }
          value={(field.options ?? []).join(OPTION_SEPARATOR)}
          onChange={(event) =>
            update({ options: event.target.value.split(OPTION_SEPARATOR) })
          }
        />
      ) : null}
      <CheckField
        id={requiredId}
        className="mt-1"
        label="Obrigatório"
        accessibleName={`Campo ${name} obrigatório`}
        checked={field.required}
        onChange={(required) => update({ required })}
      />
    </li>
  );
}

export interface StepFieldsEditorProps {
  readonly node: ProcessNode;
  readonly commands: StepFieldCommands;
}

/** Campos que a pessoa preenche ao resolver a etapa: nome, tipo, obrigatoriedade, opções da lista, criar e remover. */
export function StepFieldsEditor({
  node,
  commands,
}: Readonly<StepFieldsEditorProps>) {
  const problems = stepFieldProblems(node.data.fields ?? []);
  return (
    <fieldset className="mb-3">
      <legend className="fs-6 fw-semibold">{FIELD_LABEL.fields}</legend>
      {problems.length === 0 ? (
        <p className="small text-body-secondary mb-2">
          Nenhum campo: a etapa é resolvida sem preencher nada.
        </p>
      ) : (
        <ul className="list-unstyled d-grid gap-3 mb-2">
          {problems.map((item) => (
            <StepFieldRow
              key={item.field.id}
              nodeId={node.id}
              problems={item}
              commands={commands}
            />
          ))}
        </ul>
      )}
      <CButton
        color="secondary"
        variant="outline"
        size="sm"
        onClick={() => commands.addStepField(node.id)}
      >
        <CIcon icon={cilPlus} aria-hidden="true" className="me-1" />
        Adicionar campo
      </CButton>
    </fieldset>
  );
}

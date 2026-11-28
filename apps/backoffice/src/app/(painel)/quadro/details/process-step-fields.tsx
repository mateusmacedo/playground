import { CFormInput, CFormSelect, CFormTextarea } from '@coreui/react';
import { useId } from 'react';

import type { FieldValues, StepField } from '@/shared/process/fields';

import { CheckField } from '@/shared/ui/check-field';
import type { FieldChange } from '../use-step-form';

const REQUIRED_HELP = 'Obrigatório.';

interface StepFieldInputProps {
  readonly field: StepField;
  /** O que a pessoa preencheu; `undefined` enquanto não mexeu no campo. */
  readonly value: string | boolean | undefined;
  readonly onChange: (value: string | boolean) => void;
}

/** O controle de um campo, conforme o tipo dele: caixa, lista, texto longo, número, data ou texto. */
function StepFieldInput({
  field,
  value,
  onChange,
}: Readonly<StepFieldInputProps>) {
  const id = useId();
  const helpId = useId();
  const text = typeof value === 'string' ? value : '';
  const help = field.required ? REQUIRED_HELP : undefined;
  const common = {
    id,
    label: field.label,
    'aria-required': field.required,
  };

  if (field.type === 'checkbox') {
    return (
      <div>
        <CheckField
          id={id}
          label={field.label}
          required={field.required}
          describedBy={field.required ? helpId : undefined}
          checked={value === true}
          onChange={onChange}
        />
        {field.required ? (
          <div id={helpId} className="form-text">
            {REQUIRED_HELP}
          </div>
        ) : null}
      </div>
    );
  }
  if (field.type === 'choice') {
    return (
      <CFormSelect
        {...common}
        text={help}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecione</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </CFormSelect>
    );
  }
  if (field.type === 'long-text') {
    return (
      <CFormTextarea
        {...common}
        text={help}
        rows={2}
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <CFormInput
      {...common}
      // NOTE: os tipos `text`, `number` e `date` do campo têm o mesmo nome do tipo do controle.
      type={field.type}
      text={help}
      value={text}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export interface ProcessStepFieldsProps {
  readonly fields: readonly StepField[];
  readonly values: FieldValues;
  readonly onChange: (change: FieldChange) => void;
}

/** Campos que a etapa pede a quem a resolve; os obrigatórios vêm marcados, e quem confere o valor é o processo. */
export function ProcessStepFields({
  fields,
  values,
  onChange,
}: Readonly<ProcessStepFieldsProps>) {
  return (
    <>
      {fields.map((field) => (
        <StepFieldInput
          key={field.id}
          field={field}
          // WHY: `hasOwn` evita ler `constructor` e afins do protótipo quando o id do campo coincide com eles.
          value={Object.hasOwn(values, field.id) ? values[field.id] : undefined}
          onChange={(value) => onChange({ fieldId: field.id, value })}
        />
      ))}
    </>
  );
}

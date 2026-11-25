import { CButton, CFormInput, CFormSelect, CFormTextarea } from '@coreui/react';
import { useId } from 'react';

import type { BlockData, Duration } from '../model/blocks';
import { type BlockField, FIELD_LABEL } from '../model/conversion';
import type { Lane } from '../model/document';
import { DEFAULT_DURATION } from '../model/fields';
import type { ProcessGraph, ProcessNode } from '../process-graph';
import { DurationInput } from './time-inputs';

export type Update = (patch: Partial<BlockData>) => void;

/** O que todo controle de campo recebe. */
export interface FieldProps {
  readonly field: BlockField;
  readonly node: ProcessNode;
  readonly graph: ProcessGraph;
  readonly lanes: readonly Lane[];
  readonly update: Update;
}

export const TEXTAREA_FIELDS = new Set<BlockField>([
  'description',
  'instructions',
  'expectedResult',
  'inputs',
  'outputs',
  'content',
]);

export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface ChoiceProps<T extends string> {
  readonly label: string;
  readonly value: T | undefined;
  readonly options: readonly ChoiceOption<T>[];
  readonly placeholder?: string;
  readonly onChange: (value: T) => void;
}

/** Lista de opções; com `placeholder`, começa sem escolha e a opção vazia não pode ser escolhida de volta. */
export function Choice<T extends string>({
  label,
  value,
  options,
  placeholder,
  onChange,
}: Readonly<ChoiceProps<T>>) {
  const id = useId();
  return (
    <CFormSelect
      id={id}
      label={label}
      className="mb-3"
      value={value ?? ''}
      onChange={(event) => {
        const chosen = options.find(
          (option) => option.value === event.target.value,
        );
        if (chosen) {
          onChange(chosen.value);
        }
      }}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </CFormSelect>
  );
}

export interface RequiredDurationProps {
  readonly label: string;
  readonly value: Duration | undefined;
  readonly onChange: (value: Duration) => void;
}

/** Duração obrigatória do modo escolhido; sem valor (rascunho antigo), um botão a define. */
export function RequiredDuration({
  label,
  value,
  onChange,
}: Readonly<RequiredDurationProps>) {
  if (value === undefined) {
    return (
      <CButton
        color="warning"
        variant="outline"
        size="sm"
        className="mb-3"
        onClick={() => onChange(DEFAULT_DURATION)}
      >
        Definir {label.toLowerCase()}
      </CButton>
    );
  }
  return <DurationInput label={label} value={value} onChange={onChange} />;
}

/** Campo de texto livre, para o que é de fato texto: nomes, descrições e instruções. */
export function TextField({ field, node, update }: Readonly<FieldProps>) {
  const id = useId();
  const value = node.data[field];
  const text = typeof value === 'string' ? value : '';
  const label = FIELD_LABEL[field];
  if (TEXTAREA_FIELDS.has(field)) {
    return (
      <CFormTextarea
        id={id}
        label={label}
        rows={field === 'description' ? 2 : 3}
        className="mb-3"
        value={text}
        onChange={(event) => update({ [field]: event.target.value })}
      />
    );
  }
  return (
    <CFormInput
      id={id}
      label={label}
      className="mb-3"
      value={text}
      onChange={(event) => update({ [field]: event.target.value })}
    />
  );
}

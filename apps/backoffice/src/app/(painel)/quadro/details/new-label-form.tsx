import { CButton, CFormInput, CFormSelect } from '@coreui/react';
import { type FormEvent, useState } from 'react';

import type { LabelColor } from '../model/board';
import { LABEL_COLORS } from '../model/labels';

/** Nome e cor de uma etiqueta nova; `onCreate` diz se ela foi criada (nome repetido não é). */
export function NewLabelForm({
  onCreate,
}: Readonly<{
  onCreate: (label: { name: string; color: LabelColor }) => boolean;
}>) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<LabelColor>('primary');
  const [error, setError] = useState('');

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Dê um nome à etiqueta.');
      return;
    }
    if (onCreate({ name, color })) {
      setName('');
      setError('');
    } else {
      setError('Já existe uma etiqueta com esse nome.');
    }
  }

  return (
    <form
      className="d-flex flex-wrap gap-2 align-items-start"
      onSubmit={create}
    >
      <CFormInput
        size="sm"
        className="kanban-label-name"
        aria-label="Nome da nova etiqueta"
        placeholder="Nova etiqueta"
        value={name}
        invalid={error !== ''}
        feedbackInvalid={error}
        onChange={(event) => {
          setName(event.target.value);
          setError('');
        }}
      />
      <CFormSelect
        size="sm"
        className="w-auto"
        aria-label="Cor da nova etiqueta"
        value={color}
        onChange={(event) => setColor(event.target.value as LabelColor)}
      >
        {LABEL_COLORS.map((option) => (
          <option key={option.color} value={option.color}>
            {option.name}
          </option>
        ))}
      </CFormSelect>
      <CButton type="submit" color="secondary" variant="outline" size="sm">
        Criar
      </CButton>
    </form>
  );
}

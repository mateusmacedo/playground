import { fireEvent, render, screen, within } from '@testing-library/react';

import type { FieldValues, StepField } from '@/shared/process/fields';

import type { FieldChange } from '../use-step-form';
import { ProcessStepFields } from './process-step-fields';

interface RenderFieldsParams {
  readonly fields: readonly StepField[];
  readonly values?: FieldValues;
}

function renderFields(params: RenderFieldsParams) {
  const onChange = vi.fn<(change: FieldChange) => void>();
  render(
    <ProcessStepFields
      fields={params.fields}
      values={params.values ?? {}}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe('ProcessStepFields', () => {
  it('avisa cada mudança com o id do campo e o valor', () => {
    const onChange = renderFields({
      fields: [
        { id: 'opinion', label: 'Parecer', type: 'text', required: true },
        { id: 'agreed', label: 'De acordo', type: 'checkbox', required: false },
      ],
    });

    fireEvent.change(screen.getByLabelText('Parecer'), {
      target: { value: 'Favorável' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'De acordo' }));

    expect(onChange.mock.calls).toEqual([
      [{ fieldId: 'opinion', value: 'Favorável' }],
      [{ fieldId: 'agreed', value: true }],
    ]);
  });

  it('mostra o que a pessoa já preencheu', () => {
    renderFields({
      fields: [
        { id: 'opinion', label: 'Parecer', type: 'text', required: true },
        { id: 'agreed', label: 'De acordo', type: 'checkbox', required: false },
      ],
      values: { opinion: 'Favorável', agreed: true },
    });

    const opinion = screen.getByLabelText<HTMLInputElement>('Parecer');
    const agreed = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'De acordo',
    });

    expect(opinion.value).toBe('Favorável');
    expect(agreed.checked).toBe(true);
  });

  it('só oferece a opção vazia na lista que chegou sem opções', () => {
    renderFields({
      fields: [
        { id: 'level', label: 'Nível', type: 'choice', required: false },
      ],
    });

    const options = within(screen.getByRole('combobox', { name: 'Nível' }))
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(options).toEqual(['Selecione']);
  });

  it('deixa vazio o campo cujo id coincide com uma propriedade de todo objeto', () => {
    renderFields({
      fields: [
        { id: 'constructor', label: 'Origem', type: 'text', required: false },
      ],
    });

    expect(screen.getByLabelText<HTMLInputElement>('Origem').value).toBe('');
  });
});

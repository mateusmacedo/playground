import { fireEvent, render, screen } from '@testing-library/react';

import type { StepField } from '@/shared/process/fields';

import { block } from '../model/test-graph';
import { type ProcessNode, toProcessGraph } from '../process-graph';
import type { StepFieldCommands } from './panel-commands';
import { StepFieldsEditor } from './step-fields-editor';

function commandsMock() {
  return {
    addStepField: vi.fn(),
    updateStepField: vi.fn(),
    removeStepField: vi.fn(),
  } satisfies StepFieldCommands;
}

function renderEditor(fields?: readonly StepField[]) {
  const graph = toProcessGraph({
    nodes: [block({ id: 'step', type: 'human-task', data: { fields } })],
    edges: [],
  });
  const commands = commandsMock();
  render(
    <StepFieldsEditor
      node={graph.nodes[0] as ProcessNode}
      commands={commands}
    />,
  );
  return commands;
}

const amount: StepField = {
  id: 'amount',
  label: 'Valor aprovado',
  type: 'number',
  required: true,
};

const origin: StepField = {
  id: 'origin',
  label: 'Origem do pedido',
  type: 'choice',
  required: false,
  options: ['Loja', 'Site'],
};

describe('StepFieldsEditor', () => {
  it('diz que a etapa não pede nada e cria o primeiro campo', () => {
    const commands = renderEditor();

    expect(
      screen.getByText('Nenhum campo: a etapa é resolvida sem preencher nada.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar campo' }));

    expect(commands.addStepField).toHaveBeenCalledWith('step');
  });

  it('mostra nome, tipo e obrigatoriedade de cada campo', () => {
    renderEditor([amount, origin]);

    expect(
      (screen.getByLabelText('Nome do campo 1') as HTMLInputElement).value,
    ).toBe('Valor aprovado');
    expect(
      (
        screen.getByLabelText(
          'Tipo do campo Valor aprovado',
        ) as HTMLSelectElement
      ).value,
    ).toBe('number');
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Campo Valor aprovado obrigatório',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Campo Origem do pedido obrigatório',
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
    expect(screen.queryByText(/Nenhum campo/)).toBeNull();
  });

  it('lista os tipos de campo em PT-BR', () => {
    renderEditor([amount]);
    const type = screen.getByLabelText(
      'Tipo do campo Valor aprovado',
    ) as HTMLSelectElement;

    expect([...type.options].map((option) => option.text)).toEqual([
      'Texto curto',
      'Texto longo',
      'Número',
      'Data',
      'Lista de opções',
      'Caixa de marcação',
    ]);
  });

  it('edita o nome, o tipo e a obrigatoriedade do campo', () => {
    const commands = renderEditor([amount]);

    fireEvent.change(screen.getByLabelText('Nome do campo 1'), {
      target: { value: 'Valor' },
    });
    fireEvent.change(screen.getByLabelText('Tipo do campo Valor aprovado'), {
      target: { value: 'choice' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Campo Valor aprovado obrigatório',
      }),
    );

    expect(commands.updateStepField).toHaveBeenNthCalledWith(1, {
      nodeId: 'step',
      fieldId: 'amount',
      patch: { label: 'Valor' },
    });
    expect(commands.updateStepField).toHaveBeenNthCalledWith(2, {
      nodeId: 'step',
      fieldId: 'amount',
      patch: { type: 'choice' },
    });
    expect(commands.updateStepField).toHaveBeenNthCalledWith(3, {
      nodeId: 'step',
      fieldId: 'amount',
      patch: { required: false },
    });
  });

  it('ignora um tipo que não está na lista', () => {
    const commands = renderEditor([amount]);

    fireEvent.change(screen.getByLabelText('Tipo do campo Valor aprovado'), {
      target: { value: 'color' },
    });

    expect(commands.updateStepField).not.toHaveBeenCalled();
  });

  it('edita as opções da lista, uma por linha', () => {
    const commands = renderEditor([amount, origin]);
    const options = screen.getByLabelText(
      'Opções do campo Origem do pedido',
    ) as HTMLTextAreaElement;

    expect(options.value).toBe('Loja\nSite');
    fireEvent.change(options, { target: { value: 'Loja\nSite\nTelefone' } });

    expect(commands.updateStepField).toHaveBeenCalledWith({
      nodeId: 'step',
      fieldId: 'origin',
      patch: { options: ['Loja', 'Site', 'Telefone'] },
    });
    expect(
      screen.queryByLabelText('Opções do campo Valor aprovado'),
    ).toBeNull();
  });

  it('remove o campo', () => {
    const commands = renderEditor([amount, origin]);

    fireEvent.click(
      screen.getByRole('button', { name: 'Remover o campo Origem do pedido' }),
    );

    expect(commands.removeStepField).toHaveBeenCalledWith({
      nodeId: 'step',
      fieldId: 'origin',
    });
  });

  it('avisa campo sem nome, nome repetido e lista sem opções', () => {
    renderEditor([
      amount,
      { id: 'blank', label: ' ', type: 'text', required: false },
      { id: 'again', label: 'valor aprovado', type: 'date', required: false },
      { id: 'empty', label: 'Motivo', type: 'choice', required: false },
    ]);

    expect(screen.getByText('Dê um nome ao campo.')).toBeTruthy();
    expect(screen.getByText('Já existe um campo com este nome.')).toBeTruthy();
    expect(screen.getByText('Escreva ao menos uma opção.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Remover o campo Campo 2' }),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText('Opções do campo Motivo') as HTMLTextAreaElement)
        .value,
    ).toBe('');
  });
});

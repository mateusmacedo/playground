import type { StepField } from '@/shared/process/fields';

import type { Graph } from './blocks';
import {
  addStepField,
  FIELD_TYPE_OPTIONS,
  readStepFields,
  removeStepField,
  stepFieldName,
  updateStepField,
} from './step-fields';
import { block, link, sequentialIds } from './test-graph';

const amount: StepField = {
  id: 'amount',
  label: 'Valor',
  type: 'number',
  required: true,
};

const origin: StepField = {
  id: 'origin',
  label: 'Origem',
  type: 'choice',
  required: false,
  options: ['Loja', 'Site'],
};

const graph: Graph = {
  nodes: [
    block({ id: 'plain', type: 'task' }),
    block({
      id: 'step',
      type: 'human-task',
      data: { fields: [amount, origin] },
    }),
  ],
  edges: [link({ source: 'plain', target: 'step' })],
};

function fieldsOf(source: Graph, nodeId: string) {
  return source.nodes.find((node) => node.id === nodeId)?.data.fields;
}

describe('FIELD_TYPE_OPTIONS', () => {
  it('dá um nome em PT-BR a cada tipo de campo da base', () => {
    expect(FIELD_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      'text',
      'long-text',
      'number',
      'date',
      'choice',
      'checkbox',
    ]);
    expect(FIELD_TYPE_OPTIONS.every((option) => option.label !== '')).toBe(
      true,
    );
  });
});

describe('stepFieldName', () => {
  it('usa o nome dado ou, sem nome, a posição do campo', () => {
    expect(stepFieldName({ field: amount, position: 1 })).toBe('Valor');
    expect(
      stepFieldName({ field: { ...amount, label: '  ' }, position: 3 }),
    ).toBe('Campo 3');
  });
});

describe('readStepFields', () => {
  it('mantém o campo completo e o que ainda está pela metade', () => {
    const draft = { id: 'draft', label: '', type: 'choice', required: false };

    expect(readStepFields([amount, origin, draft])).toEqual([
      amount,
      origin,
      { ...draft, options: [] },
    ]);
  });

  it('normaliza obrigatoriedade e opções e tira opções de quem não é lista', () => {
    const items = [
      { id: 'a', label: 'A', type: 'text', required: 'sim', options: ['x'] },
      { id: 'b', label: 'B', type: 'choice', options: ['x', 7, null, 'y'] },
      { id: 'c', label: 'C', type: 'choice', options: 'x, y' },
    ];

    expect(readStepFields(items)).toEqual([
      { id: 'a', label: 'A', type: 'text', required: false },
      {
        id: 'b',
        label: 'B',
        type: 'choice',
        required: false,
        options: ['x', 'y'],
      },
      { id: 'c', label: 'C', type: 'choice', required: false, options: [] },
    ]);
  });

  it('tira o que não dá para editar e o id repetido', () => {
    const items = [
      amount,
      { ...origin, id: 'amount' },
      { ...amount, id: '' },
      { ...amount, id: 7 },
      { ...amount, id: 'no-label', label: undefined },
      { ...amount, id: 'odd', type: 'color' },
      ['amount'],
      null,
      'Valor',
    ];

    expect(readStepFields(items)).toEqual([amount]);
  });
});

describe('addStepField', () => {
  it('cria um campo de texto curto, opcional, no fim da lista', () => {
    const result = addStepField({
      graph,
      nodeId: 'step',
      createId: sequentialIds('field'),
    });

    expect(fieldsOf(result, 'step')).toEqual([
      amount,
      origin,
      { id: 'field-1', label: 'Campo 3', type: 'text', required: false },
    ]);
    expect(result.edges).toBe(graph.edges);
  });

  it('cria o primeiro campo do bloco que ainda não tem nenhum', () => {
    const result = addStepField({
      graph,
      nodeId: 'plain',
      createId: sequentialIds('field'),
    });

    expect(fieldsOf(result, 'plain')).toEqual([
      { id: 'field-1', label: 'Campo 1', type: 'text', required: false },
    ]);
  });

  it('sugere um nome que nenhum campo do bloco usa', () => {
    const createId = sequentialIds('field');
    const first = addStepField({ graph, nodeId: 'plain', createId });
    const second = addStepField({ graph: first, nodeId: 'plain', createId });
    const removed = removeStepField({
      graph: second,
      nodeId: 'plain',
      fieldId: 'field-1',
    });

    const result = addStepField({ graph: removed, nodeId: 'plain', createId });

    expect(fieldsOf(result, 'plain')?.map((field) => field.label)).toEqual([
      'Campo 2',
      'Campo 3',
    ]);
  });

  it('devolve o mesmo grafo para bloco que não existe', () => {
    const createId = sequentialIds('field');

    expect(addStepField({ graph, nodeId: 'ghost', createId })).toBe(graph);
  });
});

describe('updateStepField', () => {
  it('muda nome e obrigatoriedade sem trocar o id nem os outros campos', () => {
    const result = updateStepField({
      graph,
      nodeId: 'step',
      fieldId: 'amount',
      patch: { label: 'Valor aprovado', required: false },
    });

    expect(fieldsOf(result, 'step')).toEqual([
      {
        id: 'amount',
        label: 'Valor aprovado',
        type: 'number',
        required: false,
      },
      origin,
    ]);
  });

  it('abre a lista de opções vazia ao virar lista e tira as opções ao deixar de ser', () => {
    const asChoice = updateStepField({
      graph,
      nodeId: 'step',
      fieldId: 'amount',
      patch: { type: 'choice' },
    });
    const asText = updateStepField({
      graph,
      nodeId: 'step',
      fieldId: 'origin',
      patch: { type: 'text' },
    });

    expect(fieldsOf(asChoice, 'step')?.[0]).toEqual({
      ...amount,
      type: 'choice',
      options: [],
    });
    expect(fieldsOf(asText, 'step')?.[1]).toEqual({
      id: 'origin',
      label: 'Origem',
      type: 'text',
      required: false,
    });
  });

  it('guarda as opções como foram digitadas, uma por linha', () => {
    const result = updateStepField({
      graph,
      nodeId: 'step',
      fieldId: 'origin',
      patch: { options: ['Loja', '', 'Telefone'] },
    });

    expect(fieldsOf(result, 'step')?.[1]?.options).toEqual([
      'Loja',
      '',
      'Telefone',
    ]);
  });

  it('devolve o mesmo grafo para campo ou bloco que não existe', () => {
    const patch = { label: 'X' };

    expect(
      updateStepField({ graph, nodeId: 'step', fieldId: 'ghost', patch }),
    ).toBe(graph);
    expect(
      updateStepField({ graph, nodeId: 'ghost', fieldId: 'amount', patch }),
    ).toBe(graph);
  });
});

describe('removeStepField', () => {
  it('tira só o campo pedido', () => {
    const result = removeStepField({
      graph,
      nodeId: 'step',
      fieldId: 'amount',
    });

    expect(fieldsOf(result, 'step')).toEqual([origin]);
  });

  it('devolve o mesmo grafo para campo que não existe', () => {
    expect(removeStepField({ graph, nodeId: 'step', fieldId: 'ghost' })).toBe(
      graph,
    );
  });
});

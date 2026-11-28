import type { Graph } from './blocks';
import {
  conversionReport,
  convertBlock,
  FIELDS_BY_KIND,
  fieldLabel,
} from './conversion';
import { block, link } from './test-graph';

const graph: Graph = {
  nodes: [
    block({ id: 'start', type: 'start' }),
    block({
      id: 'step',
      type: 'task',
      data: { label: 'Analisar pedido', description: 'Conferir dados.' },
    }),
    block({ id: 'end', type: 'end' }),
  ],
  edges: [
    link({ source: 'start', target: 'step' }),
    link({ source: 'step', target: 'end' }),
  ],
};

const withFields: Graph = {
  nodes: [
    block({
      id: 'step',
      type: 'task',
      data: {
        fields: [{ id: 'f', label: 'Valor', type: 'number', required: true }],
      },
    }),
  ],
  edges: [],
};

describe('campos de cada tipo', () => {
  it('dá à Aprovação papel, instruções, prazo, descrição e campos a preencher', () => {
    expect(FIELDS_BY_KIND.approval).toEqual([
      'description',
      'role',
      'instructions',
      'dueIn',
      'fields',
    ]);
  });

  it('chama o papel da Aprovação de papel aprovador e mantém os outros nomes', () => {
    expect(fieldLabel({ kind: 'approval', field: 'role' })).toBe(
      'Papel aprovador',
    );
    expect(fieldLabel({ kind: 'approval', field: 'dueIn' })).toBe(
      'Prazo de atendimento',
    );
    expect(fieldLabel({ kind: 'human-task', field: 'role' })).toBe(
      'Papel responsável',
    );
  });
});

describe('conversionReport', () => {
  it('não acusa perda ao converter Etapa em Tarefa humana', () => {
    expect(
      conversionReport({ graph, nodeId: 'step', to: 'human-task' }),
    ).toEqual({ lostFields: [], lostEdgeIds: [], lostNodeIds: [] });
  });

  it('lista campos preenchidos e conexões sem lugar no tipo novo', () => {
    const report = conversionReport({ graph, nodeId: 'step', to: 'start' });

    expect(report.lostFields).toEqual(['Descrição']);
    expect(report.lostEdgeIds).toEqual(['start-out-step']);
  });

  it('mantém os campos a preencher na Tarefa humana e avisa a perda na automatizada', () => {
    const toHuman = conversionReport({
      graph: withFields,
      nodeId: 'step',
      to: 'human-task',
    });
    const toAutomated = conversionReport({
      graph: withFields,
      nodeId: 'step',
      to: 'automated-task',
    });

    expect(toHuman.lostFields).toEqual([]);
    expect(toAutomated.lostFields).toEqual(['Campos a preencher']);
  });

  it('usa o nome que o campo tem no tipo de origem', () => {
    const approval: Graph = {
      nodes: [
        block({ id: 'ok', type: 'approval', data: { role: 'Diretoria' } }),
      ],
      edges: [],
    };

    expect(
      conversionReport({ graph: approval, nodeId: 'ok', to: 'task' })
        .lostFields,
    ).toEqual(['Papel aprovador']);
  });

  it('mantém as exceções presas ao converter em Aprovação', () => {
    const withException: Graph = {
      nodes: [
        block({ id: 'work', type: 'human-task' }),
        { ...block({ id: 'late', type: 'exception' }), parentId: 'work' },
        block({ id: 'end', type: 'end' }),
      ],
      edges: [link({ source: 'work', target: 'end' })],
    };

    const report = conversionReport({
      graph: withException,
      nodeId: 'work',
      to: 'approval',
    });

    expect(report.lostNodeIds).toEqual([]);
    expect(report.lostEdgeIds).toEqual(['work-out-end']);
  });

  it('lista exceções presas quando o tipo novo não aceita exceção', () => {
    const withException: Graph = {
      nodes: [
        block({ id: 'work', type: 'automated-task' }),
        { ...block({ id: 'failure', type: 'exception' }), parentId: 'work' },
      ],
      edges: [],
    };

    expect(
      conversionReport({ graph: withException, nodeId: 'work', to: 'task' })
        .lostNodeIds,
    ).toEqual(['failure']);
  });
});

describe('convertBlock', () => {
  it('troca o tipo e preserva id, dados compatíveis e conexões', () => {
    const result = convertBlock({
      graph,
      nodeId: 'step',
      to: 'automated-task',
    });
    const converted = result.nodes.find((node) => node.id === 'step');

    expect(converted?.type).toBe('automated-task');
    expect(converted?.data).toMatchObject({
      label: 'Analisar pedido',
      description: 'Conferir dados.',
    });
    expect(result.edges).toEqual(graph.edges);
  });

  it('tira o que o relatório aponta como perdido', () => {
    const result = convertBlock({ graph, nodeId: 'step', to: 'start' });
    const converted = result.nodes.find((node) => node.id === 'step');

    expect(converted?.data.description).toBeUndefined();
    expect(result.edges.map((edge) => edge.id)).toEqual(['step-out-end']);
  });

  it('tira os campos a preencher quando o tipo novo não os tem', () => {
    const result = convertBlock({
      graph: withFields,
      nodeId: 'step',
      to: 'automated-task',
    });

    expect(result.nodes[0]?.data.fields).toBeUndefined();
  });

  it('devolve o mesmo grafo quando o tipo não muda', () => {
    expect(convertBlock({ graph, nodeId: 'step', to: 'task' })).toBe(graph);
  });
});

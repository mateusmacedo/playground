import type { Graph } from './blocks';
import { conversionReport, convertBlock } from './conversion';
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

  it('devolve o mesmo grafo quando o tipo não muda', () => {
    expect(convertBlock({ graph, nodeId: 'step', to: 'task' })).toBe(graph);
  });
});

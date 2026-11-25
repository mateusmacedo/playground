import type { Graph, GraphNode } from './blocks';
import {
  attachException,
  connectNewBlock,
  insertOnEdge,
  suggestedPairId,
} from './composite';
import type { LabeledEdge } from './editing';
import { block, decisionBranches, link, sequentialIds } from './test-graph';

function at(node: GraphNode, x: number, y: number): GraphNode {
  return { ...node, position: { x, y } };
}

const graph: Graph<GraphNode, LabeledEdge> = {
  nodes: [
    at(
      block({
        id: 'decision',
        type: 'decision',
        data: { branches: decisionBranches },
      }),
      0,
      0,
    ),
    at(block({ id: 'end', type: 'end' }), 0, 320),
  ],
  edges: [
    {
      ...link({ source: 'decision', target: 'end', sourceHandle: 'yes' }),
      data: { label: 'aprovado' },
    },
  ],
};

describe('insertOnEdge', () => {
  it('divide a conexão e mantém o ramo e o rótulo no trecho que sai da decisão', () => {
    const result = insertOnEdge({
      graph,
      edgeId: 'decision-yes-end',
      block: block({ id: 'step', type: 'task' }),
      createId: sequentialIds(),
    });
    const step = result.nodes.find((node) => node.id === 'step');

    expect(result.edges).toEqual([
      {
        id: 'decision-yes-end',
        source: 'decision',
        target: 'step',
        sourceHandle: 'yes',
        targetHandle: 'in',
        data: { label: 'aprovado' },
        selected: false,
      },
      {
        id: 'copy-1',
        source: 'step',
        sourceHandle: 'out',
        target: 'end',
        targetHandle: 'in',
      },
    ]);
    expect(step?.position).toEqual({ x: 224, y: 160 });
    expect(step?.selected).toBe(true);
  });

  it('não insere bloco sem entrada ou sem saída', () => {
    const result = insertOnEdge({
      graph,
      edgeId: 'decision-yes-end',
      block: block({ id: 'start', type: 'start' }),
      createId: sequentialIds(),
    });

    expect(result).toBe(graph);
  });
});

describe('connectNewBlock', () => {
  it('cria o bloco ligado à saída livre', () => {
    const result = connectNewBlock({
      graph,
      connection: { source: 'decision', sourceHandle: 'no' },
      block: block({ id: 'fix', type: 'human-task' }),
      createId: sequentialIds(),
    });

    expect(result.edges.at(-1)).toMatchObject({
      source: 'decision',
      sourceHandle: 'no',
      target: 'fix',
    });
  });

  it('não cria nada quando a saída já está ocupada', () => {
    const result = connectNewBlock({
      graph,
      connection: { source: 'decision', sourceHandle: 'yes' },
      block: block({ id: 'fix', type: 'human-task' }),
      createId: sequentialIds(),
    });

    expect(result).toBe(graph);
  });
});

describe('attachException', () => {
  it('prende a exceção à tarefa, ao lado das que já existem', () => {
    const withTask: Graph<GraphNode, LabeledEdge> = {
      nodes: [block({ id: 'work', type: 'automated-task' })],
      edges: [],
    };

    const once = attachException({
      graph: withTask,
      taskId: 'work',
      block: block({ id: 'x1', type: 'exception' }),
    });
    const twice = attachException({
      graph: once,
      taskId: 'work',
      block: block({ id: 'x2', type: 'exception' }),
    });
    const [first, second] = twice.nodes.filter(
      (node) => node.parentId === 'work',
    );

    expect(first?.id).toBe('x1');
    expect(second?.position.x).toBeLessThan(first?.position.x ?? 0);
  });
});

describe('suggestedPairId', () => {
  it('sugere a única abertura do tipo certo ainda sem par', () => {
    const splits: Graph = {
      nodes: [
        block({ id: 'p1', type: 'parallel-split' }),
        block({ id: 'p2', type: 'parallel-split' }),
        block({ id: 'j1', type: 'parallel-join', data: { pairId: 'p1' } }),
        block({ id: 'i1', type: 'inclusive-split' }),
      ],
      edges: [],
    };

    expect(suggestedPairId({ graph: splits, kind: 'parallel-join' })).toBe(
      'p2',
    );
    expect(suggestedPairId({ graph: splits, kind: 'inclusive-join' })).toBe(
      'i1',
    );
    expect(suggestedPairId({ graph: splits, kind: 'task' })).toBeUndefined();
  });
});

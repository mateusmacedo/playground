import { MarkerType } from '@xyflow/react';
import { BLOCK_SIZE } from './model/geometry';
import { block, decisionBranches, link } from './model/test-graph';
import {
  blockOrigin,
  displayEdges,
  edgeLabel,
  issuesByElement,
  type ProcessGraph,
  toProcessGraph,
} from './process-graph';

const graph: ProcessGraph = toProcessGraph({
  nodes: [
    block({
      id: 'decision',
      type: 'decision',
      data: { branches: decisionBranches },
    }),
    block({ id: 'task', type: 'outro' }),
    block({ id: 'end', type: 'end' }),
  ],
  edges: [
    link({ source: 'decision', target: 'task', sourceHandle: 'yes' }),
    {
      ...link({ source: 'task', target: 'end' }),
      sourceHandle: undefined,
      targetHandle: undefined,
    },
  ],
});

describe('toProcessGraph', () => {
  it('normaliza o tipo do bloco e as pontas das conexões', () => {
    expect(graph.nodes.map((node) => node.type)).toEqual([
      'decision',
      'task',
      'end',
    ]);
    expect(graph.edges[1]).toEqual({
      id: 'task-out-end',
      source: 'task',
      target: 'end',
      sourceHandle: null,
      targetHandle: null,
    });
  });
});

describe('issuesByElement', () => {
  it('agrupa por bloco ou conexão e deixa de fora o problema do processo', () => {
    const grouped = issuesByElement([
      { key: 'a', severity: 'error', message: 'A', nodeId: 'task' },
      { key: 'b', severity: 'error', message: 'B', nodeId: 'task' },
      { key: 'c', severity: 'error', message: 'C', edgeId: 'edge' },
      { key: 'd', severity: 'error', message: 'D' },
    ]);

    expect(grouped.get('task')?.map((issue) => issue.key)).toEqual(['a', 'b']);
    expect(grouped.get('edge')).toHaveLength(1);
    expect(grouped.size).toBe(2);
  });
});

describe('edgeLabel', () => {
  it('usa o nome do ramo e, fora dele, o rótulo da conexão', () => {
    const [branchEdge, plainEdge] = graph.edges;

    expect(edgeLabel({ graph, edge: branchEdge })).toBe('Sim');
    expect(edgeLabel({ graph, edge: plainEdge })).toBe('');
    expect(
      edgeLabel({ graph, edge: { ...plainEdge, data: { label: 'aprovado' } } }),
    ).toBe('aprovado');
  });
});

describe('displayEdges', () => {
  it('desenha seta, rótulo e destaque da conexão com problema', () => {
    const [branchEdge, plainEdge] = displayEdges({
      graph,
      issuesById: issuesByElement([
        { key: 'x', severity: 'error', message: 'X', edgeId: 'task-out-end' },
      ]),
    });

    expect(branchEdge).toMatchObject({
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      label: 'Sim',
      className: undefined,
    });
    expect(plainEdge?.label).toBeUndefined();
    expect(plainEdge?.className).toBe('process-edge--invalid');
  });
});

describe('blockOrigin', () => {
  it('centraliza o bloco no ponto', () => {
    expect(blockOrigin({ x: 100, y: 100 })).toEqual({
      x: 100 - BLOCK_SIZE.width / 2,
      y: 100 - BLOCK_SIZE.height / 2,
    });
  });
});

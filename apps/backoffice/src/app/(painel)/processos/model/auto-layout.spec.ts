import { autoLayout } from './auto-layout';
import type { Graph, GraphNode } from './blocks';
import { LANE_WIDTH, type Lane, laneAtBlock } from './document';
import { BLOCK_SIZE } from './geometry';
import { block, decisionBranches, link } from './test-graph';

function at(node: GraphNode, x: number, y: number): GraphNode {
  return { ...node, position: { x, y } };
}

function nodeOf(graph: Graph, id: string): GraphNode {
  const node = graph.nodes.find((candidate) => candidate.id === id);
  if (!node) {
    throw new Error(`bloco ${id} ausente`);
  }
  return node;
}

const lanes: Lane[] = [
  { id: 'sales', name: 'Vendas', width: LANE_WIDTH },
  { id: 'finance', name: 'Financeiro', width: LANE_WIDTH },
];

const graph: Graph = {
  nodes: [
    at(
      block({ id: 'start', type: 'start', data: { laneId: 'sales' } }),
      900,
      900,
    ),
    at(
      block({
        id: 'decision',
        type: 'decision',
        data: { laneId: 'sales', branches: decisionBranches },
      }),
      0,
      0,
    ),
    at(
      block({ id: 'pay', type: 'automated-task', data: { laneId: 'finance' } }),
      50,
      50,
    ),
    at(
      block({ id: 'again', type: 'task', data: { laneId: 'sales' } }),
      10,
      500,
    ),
    {
      ...at(block({ id: 'failure', type: 'exception' }), 16, 48),
      parentId: 'pay',
    },
    at(block({ id: 'note', type: 'annotation' }), 777, 777),
    at(block({ id: 'end', type: 'end' }), 300, 300),
  ],
  edges: [
    link({ source: 'start', target: 'decision' }),
    link({ source: 'decision', target: 'pay', sourceHandle: 'yes' }),
    link({ source: 'decision', target: 'again', sourceHandle: 'no' }),
    link({ source: 'again', target: 'decision' }),
    link({ source: 'pay', target: 'end' }),
    link({ source: 'failure', target: 'end' }),
  ],
};

describe('autoLayout', () => {
  const result = autoLayout({ graph, lanes });

  it('põe cada bloco numa camada abaixo dos antecessores, ignorando os retornos', () => {
    const startY = nodeOf(result.graph, 'start').position.y;
    const decisionY = nodeOf(result.graph, 'decision').position.y;
    const payY = nodeOf(result.graph, 'pay').position.y;
    const endY = nodeOf(result.graph, 'end').position.y;

    expect(decisionY).toBeGreaterThan(startY);
    expect(payY).toBeGreaterThan(decisionY);
    expect(endY).toBeGreaterThan(payY);
    expect(nodeOf(result.graph, 'again').position.y).toBe(payY);
  });

  it('mantém cada bloco na coluna da própria raia e a ordem das raias', () => {
    for (const id of ['start', 'decision', 'again']) {
      const { x } = nodeOf(result.graph, id).position;
      expect(laneAtBlock({ lanes: result.lanes, x })?.id).toBe('sales');
    }
    expect(
      laneAtBlock({
        lanes: result.lanes,
        x: nodeOf(result.graph, 'pay').position.x,
      })?.id,
    ).toBe('finance');
    expect(result.lanes.map((lane) => lane.id)).toEqual(['sales', 'finance']);
  });

  it('deixa o bloco sem raia numa coluna depois das raias', () => {
    const right = result.lanes.reduce((sum, lane) => sum + lane.width, 0);

    expect(nodeOf(result.graph, 'end').position.x).toBeGreaterThanOrEqual(
      right,
    );
  });

  it('não move exceções presas nem anotações e preserva as conexões', () => {
    expect(nodeOf(result.graph, 'failure').position).toEqual({ x: 16, y: 48 });
    expect(nodeOf(result.graph, 'note').position).toEqual({ x: 777, y: 777 });
    expect(result.graph.edges).toBe(graph.edges);
  });

  it('não sobrepõe blocos na mesma camada', () => {
    const flat: Graph = {
      nodes: [
        block({ id: 'start', type: 'start' }),
        block({
          id: 'split',
          type: 'parallel-split',
          data: { branches: decisionBranches },
        }),
        block({ id: 'a', type: 'task' }),
        block({ id: 'b', type: 'task' }),
      ],
      edges: [
        link({ source: 'start', target: 'split' }),
        link({ source: 'split', target: 'a', sourceHandle: 'yes' }),
        link({ source: 'split', target: 'b', sourceHandle: 'no' }),
      ],
    };

    const laidOut = autoLayout({ graph: flat, lanes: [] }).graph;
    const a = nodeOf(laidOut, 'a').position;
    const b = nodeOf(laidOut, 'b').position;

    expect(a.y).toBe(b.y);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(BLOCK_SIZE.width);
  });
});

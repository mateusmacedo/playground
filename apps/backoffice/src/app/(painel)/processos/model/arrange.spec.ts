import { alignSelection, distributeSelection } from './arrange';
import type { Graph, GraphNode } from './blocks';
import { block } from './test-graph';

function at(id: string, x: number, y: number): GraphNode {
  return {
    ...block({ id, type: 'task' }),
    position: { x, y },
    selected: true,
  };
}

function positions(graph: Graph): Record<string, { x: number; y: number }> {
  const result: Record<string, { x: number; y: number }> = {};
  for (const node of graph.nodes) {
    result[node.id] = node.position;
  }
  return result;
}

const graph: Graph = {
  nodes: [at('a', 0, 0), at('b', 160, 48), at('c', 480, 400)],
  edges: [],
};

describe('alignSelection', () => {
  it('alinha pela borda esquerda e pela de cima', () => {
    expect(positions(alignSelection({ graph, mode: 'left' }))).toMatchObject({
      a: { x: 0, y: 0 },
      b: { x: 0, y: 48 },
      c: { x: 0, y: 400 },
    });
    expect(positions(alignSelection({ graph, mode: 'top' }))).toMatchObject({
      b: { x: 160, y: 0 },
      c: { x: 480, y: 0 },
    });
  });

  it('alinha pelo centro do conjunto, na grade', () => {
    const result = positions(alignSelection({ graph, mode: 'center' }));

    expect(result.a?.x).toBe(240);
    expect(result.c?.x).toBe(240);
  });

  it('não mexe com menos de dois blocos nem nas exceções presas', () => {
    const single: Graph = { nodes: [at('a', 0, 0)], edges: [] };
    const withChild: Graph = {
      nodes: [at('a', 0, 0), { ...at('x', 16, 48), parentId: 'a' }],
      edges: [],
    };

    expect(alignSelection({ graph: single, mode: 'left' })).toBe(single);
    expect(alignSelection({ graph: withChild, mode: 'left' })).toBe(withChild);
  });
});

describe('distributeSelection', () => {
  it('espaça igualmente entre o primeiro e o último', () => {
    const result = positions(
      distributeSelection({ graph, axis: 'horizontal' }),
    );

    expect(result).toMatchObject({
      a: { x: 0, y: 0 },
      b: { x: 240, y: 48 },
      c: { x: 480, y: 400 },
    });
  });

  it('precisa de pelo menos três blocos', () => {
    const pair: Graph = { nodes: [at('a', 0, 0), at('b', 99, 0)], edges: [] };

    expect(distributeSelection({ graph: pair, axis: 'vertical' })).toBe(pair);
  });
});

describe('alignSelection nas outras bordas', () => {
  it('alinha à direita, à base e pelo meio', () => {
    expect(positions(alignSelection({ graph, mode: 'right' })).a?.x).toBe(480);
    expect(positions(alignSelection({ graph, mode: 'bottom' })).a?.y).toBe(400);
    expect(positions(alignSelection({ graph, mode: 'middle' })).c?.y).toBe(208);
  });

  it('distribui na vertical', () => {
    const result = positions(distributeSelection({ graph, axis: 'vertical' }));

    expect(result.b?.y).toBe(208);
  });
});

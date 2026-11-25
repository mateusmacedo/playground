import type { Graph } from './blocks';
import { graphAt, pathCrumbs, withInnerGraph } from './subprocess';
import { block, link } from './test-graph';

const deepest: Graph = {
  nodes: [block({ id: 'deep-start', type: 'start' })],
  edges: [],
};

const inner: Graph = {
  nodes: [
    block({
      id: 'child',
      type: 'subprocess',
      data: { label: 'Cobrança', process: deepest },
    }),
  ],
  edges: [],
};

const root: Graph = {
  nodes: [
    block({
      id: 'parent',
      type: 'subprocess',
      data: { label: 'Atendimento', process: inner },
    }),
    block({ id: 'task', type: 'task' }),
  ],
  edges: [link({ source: 'parent', target: 'task' })],
};

describe('graphAt', () => {
  it('devolve a raiz com caminho vazio e o canvas interno pelo caminho', () => {
    expect(graphAt({ root, path: [] })).toBe(root);
    expect(graphAt({ root, path: ['parent', 'child'] })).toBe(deepest);
  });

  it('devolve undefined quando o caminho passa por algo que não é subprocesso', () => {
    expect(graphAt({ root, path: ['task'] })).toBeUndefined();
    expect(graphAt({ root, path: ['sumiu', 'child'] })).toBeUndefined();
  });
});

describe('pathCrumbs', () => {
  it('nomeia cada subprocesso do caminho', () => {
    expect(pathCrumbs({ root, path: ['parent', 'child'] })).toEqual([
      { nodeId: 'parent', name: 'Atendimento' },
      { nodeId: 'child', name: 'Cobrança' },
    ]);
  });
});

describe('withInnerGraph', () => {
  it('troca o canvas mais interno e preserva o resto', () => {
    const replacement: Graph = { nodes: [], edges: [] };

    const result = withInnerGraph({
      root,
      path: ['parent', 'child'],
      inner: replacement,
    });

    expect(graphAt({ root: result, path: ['parent', 'child'] })).toBe(
      replacement,
    );
    expect(result.edges).toBe(root.edges);
    expect(graphAt({ root, path: ['parent', 'child'] })).toBe(deepest);
  });

  it('devolve a própria raiz quando o caminho é vazio ou inválido', () => {
    const replacement: Graph = { nodes: [], edges: [] };

    expect(withInnerGraph({ root, path: [], inner: replacement })).toBe(root);
    expect(withInnerGraph({ root, path: ['task'], inner: replacement })).toBe(
      root,
    );
  });
});

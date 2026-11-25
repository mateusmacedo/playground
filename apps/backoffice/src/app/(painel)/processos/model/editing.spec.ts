import type { Graph, GraphEdge, LinkData } from './blocks';
import {
  addBranch,
  DUPLICATE_OFFSET,
  deleteSelection,
  duplicateSelection,
  reconnectEdge,
  removeBranch,
  renameBranch,
  updateBlockData,
  updateEdgeLabel,
} from './editing';
import { block, decisionBranches, link } from './test-graph';

function sequentialIds() {
  let next = 0;
  return () => {
    next += 1;
    return `copy-${next}`;
  };
}

const graph: Graph = {
  nodes: [
    block('start', 'start'),
    block('decision', 'decision', { branches: decisionBranches }),
    block('task', 'task'),
    block('end', 'end'),
  ],
  edges: [
    link('start', 'decision'),
    link('decision', 'task', 'yes'),
    link('decision', 'end', 'no'),
    link('task', 'end'),
  ],
};

function select(
  source: Graph,
  ids: { readonly nodes?: string[]; readonly edges?: string[] },
): Graph {
  return {
    nodes: source.nodes.map((node) => ({
      ...node,
      selected: ids.nodes?.includes(node.id) ?? false,
    })),
    edges: source.edges.map((edge) => ({
      ...edge,
      selected: ids.edges?.includes(edge.id) ?? false,
    })),
  };
}

describe('deleteSelection', () => {
  it('tira os blocos selecionados e as conexões ligadas a eles', () => {
    const result = deleteSelection(select(graph, { nodes: ['task'] }));

    expect(result.nodes.map((node) => node.id)).toEqual([
      'start',
      'decision',
      'end',
    ]);
    expect(result.edges.map((edge) => edge.id)).toEqual([
      'start-out-decision',
      'decision-no-end',
    ]);
  });

  it('tira só a conexão selecionada', () => {
    const result = deleteSelection(
      select(graph, { edges: ['decision-no-end'] }),
    );

    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);
  });

  it('devolve o mesmo grafo sem seleção', () => {
    expect(deleteSelection(graph)).toBe(graph);
  });
});

describe('duplicateSelection', () => {
  it('copia os blocos selecionados e as conexões entre eles, e seleciona as cópias', () => {
    const result = duplicateSelection({
      graph: select(graph, {
        nodes: ['decision', 'task'],
        edges: ['task-out-end'],
      }),
      createId: sequentialIds(),
    });
    const copies = result.nodes.filter((node) => node.selected);

    expect(copies.map((node) => node.id)).toEqual(['copy-1', 'copy-2']);
    expect(copies[0]?.position).toEqual(DUPLICATE_OFFSET);
    expect(copies[0]?.data.branches).toEqual(decisionBranches);
    expect(result.nodes).toHaveLength(6);
    expect(result.edges.at(-1)).toMatchObject({
      id: 'copy-3',
      source: 'copy-1',
      target: 'copy-2',
      sourceHandle: 'yes',
    });
    expect(result.edges).toHaveLength(5);
    expect(result.edges.some((edge) => edge.selected)).toBe(false);
  });

  it('devolve o mesmo grafo sem seleção', () => {
    expect(duplicateSelection({ graph, createId: sequentialIds() })).toBe(
      graph,
    );
  });
});

describe('reconnectEdge', () => {
  it('move a ponta da conexão quando a regra deixa', () => {
    const result = reconnectEdge({
      graph,
      edgeId: 'decision-no-end',
      connection: { source: 'decision', target: 'task', sourceHandle: 'no' },
    });

    expect(result).toBe(graph);

    const moved = reconnectEdge({
      graph,
      edgeId: 'task-out-end',
      connection: { source: 'task', target: 'end' },
    });
    expect(moved.edges.at(-1)).toMatchObject({
      source: 'task',
      target: 'end',
      sourceHandle: null,
      targetHandle: null,
    });
  });

  it('devolve o mesmo grafo para conexão que não existe', () => {
    expect(
      reconnectEdge({
        graph,
        edgeId: 'x',
        connection: { source: 'task', target: 'end' },
      }),
    ).toBe(graph);
  });
});

describe('edição dos dados', () => {
  it('atualiza os dados do bloco', () => {
    const result = updateBlockData({
      graph,
      nodeId: 'task',
      patch: { label: 'Revisar', description: 'Checar o pedido.' },
    });

    expect(result.nodes[2]?.data).toEqual({
      label: 'Revisar',
      description: 'Checar o pedido.',
    });
    expect(result.edges).toBe(graph.edges);
  });

  it('devolve o mesmo grafo para bloco que não existe', () => {
    expect(updateBlockData({ graph, nodeId: 'x', patch: { label: 'y' } })).toBe(
      graph,
    );
    expect(removeBranch({ graph, nodeId: 'x', branchId: 'yes' })).toBe(graph);
  });
});

describe('ramos da Decisão', () => {
  it('cria ramo com nome provisório pela ordem', () => {
    const result = addBranch({
      graph,
      nodeId: 'decision',
      createId: () => 'maybe',
    });

    expect(result.nodes[1]?.data.branches?.at(-1)).toEqual({
      id: 'maybe',
      label: 'Caminho 3',
    });

    const first = addBranch({ graph, nodeId: 'task', createId: () => 'b1' });
    expect(first.nodes[2]?.data.branches).toEqual([
      { id: 'b1', label: 'Caminho 1' },
    ]);
  });

  it('renomeia o ramo', () => {
    const result = renameBranch({
      graph,
      nodeId: 'decision',
      branchId: 'no',
      label: 'Recusado',
    });

    expect(result.nodes[1]?.data.branches).toEqual([
      { id: 'yes', label: 'Sim' },
      { id: 'no', label: 'Recusado' },
    ]);

    const noBranches = renameBranch({
      graph,
      nodeId: 'task',
      branchId: 'no',
      label: 'x',
    });
    expect(noBranches.nodes[2]?.data.branches).toEqual([]);
  });

  it('remove o ramo e a conexão que saía dele', () => {
    const result = removeBranch({ graph, nodeId: 'decision', branchId: 'yes' });

    expect(result.nodes[1]?.data.branches).toEqual([
      { id: 'no', label: 'Não' },
    ]);
    expect(result.edges.map((edge) => edge.id)).toEqual([
      'start-out-decision',
      'decision-no-end',
      'task-out-end',
    ]);

    const noBranches = removeBranch({ graph, nodeId: 'task', branchId: 'x' });
    expect(noBranches.nodes[2]?.data.branches).toEqual([]);
  });
});

describe('updateEdgeLabel', () => {
  const labeled: Graph<
    (typeof graph.nodes)[number],
    GraphEdge & { readonly data?: LinkData }
  > = graph;

  it('troca o rótulo da conexão', () => {
    const result = updateEdgeLabel({
      graph: labeled,
      edgeId: 'task-out-end',
      label: 'concluído',
    });

    expect(result.edges.at(-1)?.data).toEqual({ label: 'concluído' });
  });

  it('devolve o mesmo grafo para conexão que não existe', () => {
    expect(updateEdgeLabel({ graph: labeled, edgeId: 'x', label: 'y' })).toBe(
      labeled,
    );
  });
});

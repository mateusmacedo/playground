import type { Graph, GraphEdge, LinkData } from './blocks';
import {
  addBranch,
  deleteSelection,
  reconnectEdge,
  removeBranch,
  renameBranch,
  setDefaultBranch,
  updateBlockData,
  updateEdgeLabel,
} from './editing';
import { block, decisionBranches, link, sequentialIds } from './test-graph';

const graph: Graph = {
  nodes: [
    block({ id: 'start', type: 'start' }),
    block({
      id: 'decision',
      type: 'decision',
      data: { branches: decisionBranches },
    }),
    block({ id: 'task', type: 'task' }),
    block({ id: 'end', type: 'end' }),
  ],
  edges: [
    link({ source: 'start', target: 'decision' }),
    link({ source: 'decision', target: 'task', sourceHandle: 'yes' }),
    link({ source: 'decision', target: 'end', sourceHandle: 'no' }),
    link({ source: 'task', target: 'end' }),
  ],
};

interface SelectParams {
  readonly source: Graph;
  readonly ids: { readonly nodes?: string[]; readonly edges?: string[] };
}

function select({ source, ids }: Readonly<SelectParams>): Graph {
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
    const result = deleteSelection(
      select({ source: graph, ids: { nodes: ['task'] } }),
    );

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

  it('tira junto as exceções presas ao bloco excluído e as conexões delas', () => {
    const withExceptions: Graph = {
      nodes: [
        block({ id: 'person', type: 'human-task' }),
        block({ id: 'approval', type: 'approval' }),
        { ...block({ id: 'late', type: 'exception' }), parentId: 'person' },
        { ...block({ id: 'failed', type: 'exception' }), parentId: 'person' },
        { ...block({ id: 'kept', type: 'exception' }), parentId: 'approval' },
        block({ id: 'end', type: 'end' }),
      ],
      edges: [
        link({ source: 'person', target: 'approval' }),
        link({ source: 'late', target: 'end' }),
        link({ source: 'kept', target: 'end' }),
      ],
    };

    const result = deleteSelection(
      select({ source: withExceptions, ids: { nodes: ['person'] } }),
    );

    expect(result.nodes.map((node) => node.id)).toEqual([
      'approval',
      'kept',
      'end',
    ]);
    expect(result.edges.map((edge) => edge.id)).toEqual(['kept-out-end']);
  });

  it('tira só a conexão selecionada', () => {
    const result = deleteSelection(
      select({ source: graph, ids: { edges: ['decision-no-end'] } }),
    );

    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);
  });

  it('devolve o mesmo grafo sem seleção', () => {
    expect(deleteSelection(graph)).toBe(graph);
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

  it('sugere o primeiro nome livre depois que um ramo é removido', () => {
    const createId = sequentialIds('branch');
    const third = addBranch({ graph, nodeId: 'decision', createId });
    const fourth = addBranch({ graph: third, nodeId: 'decision', createId });
    const removed = removeBranch({
      graph: fourth,
      nodeId: 'decision',
      branchId: 'branch-1',
    });

    const result = addBranch({ graph: removed, nodeId: 'decision', createId });

    expect(
      result.nodes[1]?.data.branches?.map((branch) => branch.label),
    ).toEqual(['Sim', 'Não', 'Caminho 4', 'Caminho 5']);
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

describe('setDefaultBranch', () => {
  it('marca o caminho padrão e limpa a condição dele', () => {
    const decision: Graph = {
      nodes: [
        block({
          id: 'd',
          type: 'decision',
          data: {
            branches: [
              { id: 'yes', label: 'Sim', condition: 'aprovado' },
              { id: 'no', label: 'Não', condition: 'recusado' },
            ],
          },
        }),
      ],
      edges: [],
    };

    const result = setDefaultBranch({
      graph: decision,
      nodeId: 'd',
      branchId: 'no',
    });
    const data = result.nodes[0]?.data;

    expect(data?.defaultBranchId).toBe('no');
    expect(data?.branches).toEqual([
      { id: 'yes', label: 'Sim', condition: 'aprovado' },
      { id: 'no', label: 'Não', condition: undefined },
    ]);
  });
});

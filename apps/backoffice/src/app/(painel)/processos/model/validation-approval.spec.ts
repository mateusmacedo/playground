import type { Graph, GraphNode } from './blocks';
import { block, link } from './test-graph';
import { findIssues } from './validation';

function attached(node: GraphNode, parentId: string): GraphNode {
  return { ...node, parentId };
}

const approval = block({
  id: 'ok',
  type: 'approval',
  data: { label: 'Aprovar compra', role: 'Diretoria' },
});

/** Compra que passa pela aprovação e termina concluída ou recusada. */
const purchase: Graph = {
  nodes: [
    block({ id: 'start', type: 'start', data: { trigger: 'manual' } }),
    approval,
    block({ id: 'done', type: 'end', data: { outcome: 'completed' } }),
    block({ id: 'refused', type: 'end', data: { outcome: 'rejected' } }),
  ],
  edges: [
    link({ source: 'start', target: 'ok' }),
    link({ source: 'ok', target: 'done', sourceHandle: 'approved' }),
    link({ source: 'ok', target: 'refused', sourceHandle: 'rejected' }),
  ],
};

describe('findIssues na Aprovação', () => {
  it('não aponta nada com papel aprovador e os dois pareceres conectados', () => {
    expect(findIssues(purchase)).toEqual([]);
  });

  it('aponta cada parecer sem conexão como erro', () => {
    const graph: Graph = {
      nodes: purchase.nodes,
      edges: [link({ source: 'start', target: 'ok' })],
    };

    expect(findIssues(graph)).toEqual(
      expect.arrayContaining([
        {
          key: 'port-unlinked:approved:ok',
          nodeId: 'ok',
          severity: 'error',
          message: 'Aprovar compra: a saída "Aprovado" não está conectada.',
        },
        {
          key: 'port-unlinked:rejected:ok',
          nodeId: 'ok',
          severity: 'error',
          message: 'Aprovar compra: a saída "Rejeitado" não está conectada.',
        },
      ]),
    );
  });

  it('aponta só o parecer que ficou sem conexão', () => {
    const graph: Graph = {
      nodes: purchase.nodes,
      edges: purchase.edges.slice(0, 2),
    };

    const keys = findIssues(graph).map((issue) => issue.key);

    expect(keys).toContain('port-unlinked:rejected:ok');
    expect(keys).not.toContain('port-unlinked:approved:ok');
  });

  it('avisa a Aprovação sem papel aprovador, sem tratar como erro de estrutura', () => {
    const graph: Graph = {
      nodes: purchase.nodes.map((node) =>
        node.id === 'ok'
          ? { ...node, data: { label: 'Aprovar compra' } }
          : node,
      ),
      edges: purchase.edges,
    };

    expect(findIssues(graph)).toEqual([
      {
        key: 'incomplete-role:ok',
        nodeId: 'ok',
        severity: 'warning',
        message: 'Aprovar compra não tem papel aprovador.',
      },
    ]);
  });

  it('aceita Evento de exceção preso à Aprovação', () => {
    const late = attached(
      block({
        id: 'late',
        type: 'exception',
        data: {
          exceptionTrigger: 'timeout',
          timeout: { amount: 2, unit: 'days' },
        },
      }),
      'ok',
    );
    const graph: Graph = {
      nodes: [...purchase.nodes, late],
      edges: [...purchase.edges, link({ source: 'late', target: 'refused' })],
    };

    expect(findIssues(graph)).toEqual([]);
  });

  it('diz onde a exceção solta pode ser presa, com a aprovação entre as opções', () => {
    const graph: Graph = {
      nodes: [...purchase.nodes, block({ id: 'loose', type: 'exception' })],
      edges: purchase.edges,
    };

    expect(findIssues(graph)).toContainEqual(
      expect.objectContaining({
        key: 'detached-exception:loose',
        message:
          'loose precisa estar preso a uma tarefa humana, aprovação, tarefa automatizada ou subprocesso.',
      }),
    );
  });
});

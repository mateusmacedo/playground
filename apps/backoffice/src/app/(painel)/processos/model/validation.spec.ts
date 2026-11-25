import type { Graph } from './blocks';
import { sampleProcess } from './sample-process';
import { block, decisionBranches, link } from './test-graph';
import { findIssues } from './validation';

function keys(graph: Graph): string[] {
  return findIssues(graph).map((issue) => issue.key);
}

describe('findIssues', () => {
  it('não aponta nada no processo de exemplo', () => {
    expect(findIssues(sampleProcess)).toEqual([]);
  });

  it('aponta processo sem Início, inclusive vazio', () => {
    expect(findIssues({ nodes: [], edges: [] })).toEqual([
      { key: 'missing-start', message: 'O processo não tem um bloco Início.' },
    ]);
  });

  it('sem Início, não repete "inalcançável" em cada bloco', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'task', type: 'task' }),
        block({ id: 'end', type: 'end' }),
      ],
      edges: [link({ source: 'task', target: 'end' })],
    };

    expect(keys(graph)).toEqual(['missing-start', 'no-input:task']);
  });

  it('aponta cada Início quando há mais de um', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'a', type: 'start' }),
        block({ id: 'b', type: 'start' }),
        block({ id: 'end', type: 'end' }),
      ],
      edges: [
        link({ source: 'a', target: 'end' }),
        link({ source: 'b', target: 'end' }),
      ],
    };

    expect(keys(graph)).toEqual(['multiple-starts:a', 'multiple-starts:b']);
  });

  it('aponta bloco sem entrada ou sem saída, com o nome do tipo quando o título está vazio', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'start', type: 'start' }),
        block({ id: 'task', type: 'task', data: { label: ' ' } }),
      ],
      edges: [],
    };
    const issues = findIssues(graph);

    expect(issues.map((issue) => issue.key)).toEqual([
      'no-output:start',
      'no-input:task',
      'no-output:task',
    ]);
    expect(issues[1]?.message).toBe('Etapa não tem conexão de entrada.');
    expect(issues[1]?.nodeId).toBe('task');
  });

  it('aponta Convergência com uma só entrada', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'start', type: 'start' }),
        block({ id: 'merge', type: 'merge' }),
        block({ id: 'end', type: 'end' }),
      ],
      edges: [
        link({ source: 'start', target: 'merge' }),
        link({ source: 'merge', target: 'end' }),
      ],
    };

    expect(keys(graph)).toEqual(['few-inputs:merge']);
  });

  it('aponta Decisão com menos de dois ramos e ramo sem conexão', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'start', type: 'start' }),
        block({
          id: 'decision',
          type: 'decision',
          data: { branches: decisionBranches },
        }),
        block({
          id: 'single',
          type: 'decision',
          data: {
            branches: [{ id: 'only', label: 'Único' }],
          },
        }),
        block({ id: 'end', type: 'end' }),
      ],
      edges: [
        link({ source: 'start', target: 'decision' }),
        link({ source: 'decision', target: 'end', sourceHandle: 'yes' }),
        link({ source: 'decision', target: 'single', sourceHandle: 'no' }),
        link({ source: 'single', target: 'end', sourceHandle: 'only' }),
      ],
    };
    const issues = findIssues(graph);

    expect(issues.map((issue) => issue.key)).toEqual(['few-branches:single']);

    const unlinked = findIssues({
      ...graph,
      edges: graph.edges.filter((edge) => edge.id !== 'decision-yes-end'),
    });
    expect(unlinked.map((issue) => issue.message)).toContain(
      'decision: o ramo "Sim" não está conectado.',
    );
  });

  it('aponta bloco que não é alcançado a partir do Início', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'start', type: 'start' }),
        block({ id: 'end', type: 'end' }),
        block({ id: 'loop-a', type: 'task' }),
        block({ id: 'loop-b', type: 'task' }),
      ],
      edges: [
        link({ source: 'start', target: 'end' }),
        link({ source: 'loop-a', target: 'loop-b' }),
        link({ source: 'loop-b', target: 'loop-a' }),
      ],
    };

    expect(keys(graph)).toEqual(['unreachable:loop-a', 'unreachable:loop-b']);
  });

  it('ignora as anotações', () => {
    expect(
      findIssues({
        nodes: [
          ...sampleProcess.nodes,
          block({ id: 'note', type: 'annotation' }),
        ],
        edges: sampleProcess.edges,
      }),
    ).toEqual([]);
  });

  it('aponta conexão que quebra as regras', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'start', type: 'start' }),
        block({ id: 'task', type: 'task' }),
        block({ id: 'end', type: 'end' }),
      ],
      edges: [
        link({ source: 'start', target: 'task' }),
        link({ source: 'task', target: 'end' }),
        link({ source: 'end', target: 'task' }),
      ],
    };
    const issues = findIssues(graph);

    expect(issues).toContainEqual({
      key: 'invalid-edge:end-out-task',
      edgeId: 'end-out-task',
      message: 'Conexão inválida: o bloco de origem não tem saída.',
    });
  });
});

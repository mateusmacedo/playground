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
      nodes: [block('task', 'task'), block('end', 'end')],
      edges: [link('task', 'end')],
    };

    expect(keys(graph)).toEqual(['missing-start', 'no-input:task']);
  });

  it('aponta cada Início quando há mais de um', () => {
    const graph: Graph = {
      nodes: [block('a', 'start'), block('b', 'start'), block('end', 'end')],
      edges: [link('a', 'end'), link('b', 'end')],
    };

    expect(keys(graph)).toEqual(['multiple-starts:a', 'multiple-starts:b']);
  });

  it('aponta bloco sem entrada ou sem saída, com o nome do tipo quando o título está vazio', () => {
    const graph: Graph = {
      nodes: [block('start', 'start'), block('task', 'task', { label: ' ' })],
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
        block('start', 'start'),
        block('merge', 'merge'),
        block('end', 'end'),
      ],
      edges: [link('start', 'merge'), link('merge', 'end')],
    };

    expect(keys(graph)).toEqual(['few-inputs:merge']);
  });

  it('aponta Decisão com menos de dois ramos e ramo sem conexão', () => {
    const graph: Graph = {
      nodes: [
        block('start', 'start'),
        block('decision', 'decision', { branches: decisionBranches }),
        block('single', 'decision', {
          branches: [{ id: 'only', label: 'Único' }],
        }),
        block('end', 'end'),
      ],
      edges: [
        link('start', 'decision'),
        link('decision', 'end', 'yes'),
        link('decision', 'single', 'no'),
        link('single', 'end', 'only'),
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
        block('start', 'start'),
        block('end', 'end'),
        block('loop-a', 'task'),
        block('loop-b', 'task'),
      ],
      edges: [
        link('start', 'end'),
        link('loop-a', 'loop-b'),
        link('loop-b', 'loop-a'),
      ],
    };

    expect(keys(graph)).toEqual(['unreachable:loop-a', 'unreachable:loop-b']);
  });

  it('ignora as anotações', () => {
    expect(
      findIssues({
        nodes: [...sampleProcess.nodes, block('note', 'annotation')],
        edges: sampleProcess.edges,
      }),
    ).toEqual([]);
  });

  it('aponta conexão que quebra as regras', () => {
    const graph: Graph = {
      nodes: [
        block('start', 'start'),
        block('task', 'task'),
        block('end', 'end'),
      ],
      edges: [link('start', 'task'), link('task', 'end'), link('end', 'task')],
    };
    const issues = findIssues(graph);

    expect(issues).toContainEqual({
      key: 'invalid-edge:end-out-task',
      edgeId: 'end-out-task',
      message: 'Conexão inválida: o bloco de origem não tem saída.',
    });
  });
});

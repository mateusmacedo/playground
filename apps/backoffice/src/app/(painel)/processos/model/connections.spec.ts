import type { Graph } from './blocks';
import { connectionProblem, sourceHandleOf } from './connections';
import { block, decisionBranches, link } from './test-graph';

const graph: Graph = {
  nodes: [
    block('start', 'start'),
    block('task', 'task'),
    block('other', 'task'),
    block('decision', 'decision', { branches: decisionBranches }),
    block('merge', 'merge'),
    block('end', 'end'),
    block('note', 'annotation'),
  ],
  edges: [link('start', 'task'), link('decision', 'merge', 'yes')],
};

function problem(
  connection: Parameters<typeof connectionProblem>[0]['connection'],
  ignoreEdgeId?: string,
) {
  return connectionProblem({ graph, connection, ignoreEdgeId });
}

describe('connectionProblem', () => {
  it('aceita a conexão que respeita as regras', () => {
    expect(
      problem({ source: 'task', target: 'end', sourceHandle: 'out' }),
    ).toBeNull();
    expect(
      problem({ source: 'decision', target: 'end', sourceHandle: 'no' }),
    ).toBeNull();
  });

  it('aceita várias entradas na Convergência e no Fim', () => {
    expect(
      problem({ source: 'task', target: 'merge', sourceHandle: 'out' }),
    ).toBeNull();
  });

  it('recusa bloco inexistente e ligação do bloco com ele mesmo', () => {
    expect(problem({ source: 'x', target: 'end' })).toBe('unknown-block');
    expect(problem({ source: 'task', target: 'task' })).toBe('self');
  });

  it('recusa sair de bloco sem saída e entrar em bloco sem entrada', () => {
    expect(problem({ source: 'end', target: 'task' })).toBe('no-output');
    expect(problem({ source: 'note', target: 'task' })).toBe('no-output');
    expect(problem({ source: 'other', target: 'start' })).toBe('no-input');
    expect(problem({ source: 'other', target: 'note' })).toBe('no-input');
  });

  it('recusa ponto de saída que o bloco não tem', () => {
    expect(
      problem({ source: 'decision', target: 'end', sourceHandle: 'talvez' }),
    ).toBe('unknown-output');
  });

  it('recusa conexão repetida e saída já ocupada', () => {
    expect(
      problem({ source: 'decision', target: 'merge', sourceHandle: 'yes' }),
    ).toBe('duplicate');
    expect(problem({ source: 'start', target: 'other' })).toBe('output-taken');
  });

  it('recusa a segunda entrada numa Etapa ou Decisão', () => {
    expect(
      problem({ source: 'decision', target: 'task', sourceHandle: 'no' }),
    ).toBe('input-taken');
  });

  it('ignora a própria conexão ao reconectá-la', () => {
    expect(
      problem({ source: 'start', target: 'other' }, 'start-out-task'),
    ).toBeNull();
  });
});

describe('sourceHandleOf', () => {
  it('usa a saída única quando a conexão não diz o ponto', () => {
    expect(sourceHandleOf({ sourceHandle: null })).toBe('out');
    expect(sourceHandleOf({ sourceHandle: 'yes' })).toBe('yes');
  });
});

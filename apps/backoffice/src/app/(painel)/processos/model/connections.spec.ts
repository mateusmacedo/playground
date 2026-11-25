import type { Graph } from './blocks';
import { connectionProblem, sourceHandleOf } from './connections';
import { block, decisionBranches, link } from './test-graph';

const graph: Graph = {
  nodes: [
    block({ id: 'start', type: 'start' }),
    block({ id: 'task', type: 'task' }),
    block({ id: 'other', type: 'task' }),
    block({
      id: 'decision',
      type: 'decision',
      data: { branches: decisionBranches },
    }),
    block({ id: 'merge', type: 'merge' }),
    block({ id: 'end', type: 'end' }),
    block({ id: 'note', type: 'annotation' }),
  ],
  edges: [
    link({ source: 'start', target: 'task' }),
    link({ source: 'decision', target: 'merge', sourceHandle: 'yes' }),
  ],
};

interface ProblemParams {
  readonly connection: Parameters<typeof connectionProblem>[0]['connection'];
  readonly ignoreEdgeId?: string;
}

function problem({ connection, ignoreEdgeId }: Readonly<ProblemParams>) {
  return connectionProblem({ graph, connection, ignoreEdgeId });
}

describe('connectionProblem', () => {
  it('aceita a conexão que respeita as regras', () => {
    expect(
      problem({
        connection: { source: 'task', target: 'end', sourceHandle: 'out' },
      }),
    ).toBeNull();
    expect(
      problem({
        connection: { source: 'decision', target: 'end', sourceHandle: 'no' },
      }),
    ).toBeNull();
  });

  it('aceita várias entradas na Convergência e no Fim', () => {
    expect(
      problem({
        connection: { source: 'task', target: 'merge', sourceHandle: 'out' },
      }),
    ).toBeNull();
  });

  it('recusa bloco inexistente e ligação do bloco com ele mesmo', () => {
    expect(problem({ connection: { source: 'x', target: 'end' } })).toBe(
      'unknown-block',
    );
    expect(problem({ connection: { source: 'task', target: 'task' } })).toBe(
      'self',
    );
  });

  it('recusa sair de bloco sem saída e entrar em bloco sem entrada', () => {
    expect(problem({ connection: { source: 'end', target: 'task' } })).toBe(
      'no-output',
    );
    expect(problem({ connection: { source: 'note', target: 'task' } })).toBe(
      'no-output',
    );
    expect(problem({ connection: { source: 'other', target: 'start' } })).toBe(
      'no-input',
    );
    expect(problem({ connection: { source: 'other', target: 'note' } })).toBe(
      'no-input',
    );
  });

  it('recusa ponto de saída que o bloco não tem', () => {
    expect(
      problem({
        connection: {
          source: 'decision',
          target: 'end',
          sourceHandle: 'talvez',
        },
      }),
    ).toBe('unknown-output');
  });

  it('recusa conexão repetida e saída já ocupada', () => {
    expect(
      problem({
        connection: {
          source: 'decision',
          target: 'merge',
          sourceHandle: 'yes',
        },
      }),
    ).toBe('duplicate');
    expect(problem({ connection: { source: 'start', target: 'other' } })).toBe(
      'output-taken',
    );
  });

  it('recusa a segunda entrada numa Etapa ou Decisão', () => {
    expect(
      problem({
        connection: { source: 'decision', target: 'task', sourceHandle: 'no' },
      }),
    ).toBe('input-taken');
  });

  it('ignora a própria conexão ao reconectá-la', () => {
    expect(
      problem({
        connection: { source: 'start', target: 'other' },
        ignoreEdgeId: 'start-out-task',
      }),
    ).toBeNull();
  });
});

describe('sourceHandleOf', () => {
  it('usa a saída única quando a conexão não diz o ponto', () => {
    expect(sourceHandleOf({ sourceHandle: null })).toBe('out');
    expect(sourceHandleOf({ sourceHandle: 'yes' })).toBe('yes');
  });
});

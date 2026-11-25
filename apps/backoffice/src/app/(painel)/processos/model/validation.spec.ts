import type { Graph, GraphNode } from './blocks';
import { sampleProcess } from './sample-process';
import { block, decisionBranches, link } from './test-graph';
import { findIssues } from './validation';

function keys(graph: Graph): string[] {
  return findIssues(graph).map((issue) => issue.key);
}

function attached(node: GraphNode, parentId: string): GraphNode {
  return { ...node, parentId };
}

const parallelBranches = [
  { id: 'left', label: 'Caminho 1' },
  { id: 'right', label: 'Caminho 2' },
];

/**
 * Fluxo de referência do aceite: análise com retorno após resposta, expiração com fim próprio e dois ramos paralelos,
 * um deles com exceção que converge antes da sincronização.
 */
const referenceProcess: Graph = {
  nodes: [
    block({ id: 'start', type: 'start', data: { trigger: 'manual' } }),
    block({ id: 'again', type: 'merge' }),
    block({ id: 'review', type: 'human-task', data: { role: 'Analista' } }),
    block({
      id: 'complete',
      type: 'decision',
      data: { label: 'Dados completos?', branches: decisionBranches },
    }),
    block({
      id: 'ask',
      type: 'send-message',
      data: { recipient: 'Cliente', channel: 'email' },
    }),
    block({
      id: 'wait',
      type: 'wait-event',
      data: {
        eventName: 'Resposta do cliente',
        deadline: { amount: 48, unit: 'hours' },
      },
    }),
    block({ id: 'expired', type: 'end', data: { outcome: 'expired' } }),
    block({
      id: 'split',
      type: 'parallel-split',
      data: { branches: parallelBranches },
    }),
    block({ id: 'register', type: 'automated-task', data: { system: 'ERP' } }),
    attached(
      block({
        id: 'failure',
        type: 'exception',
        data: { exceptionTrigger: 'error' },
      }),
      'register',
    ),
    block({ id: 'manual', type: 'human-task', data: { role: 'Suporte' } }),
    block({ id: 'registered', type: 'merge' }),
    block({ id: 'notify', type: 'human-task', data: { role: 'Atendimento' } }),
    block({ id: 'sync', type: 'parallel-join', data: { pairId: 'split' } }),
    block({ id: 'close', type: 'human-task', data: { role: 'Analista' } }),
    block({ id: 'done', type: 'end', data: { outcome: 'completed' } }),
  ],
  edges: [
    link({ source: 'start', target: 'again' }),
    link({ source: 'again', target: 'review' }),
    link({ source: 'review', target: 'complete' }),
    link({ source: 'complete', target: 'split', sourceHandle: 'yes' }),
    link({ source: 'complete', target: 'ask', sourceHandle: 'no' }),
    link({ source: 'ask', target: 'wait' }),
    link({ source: 'wait', target: 'again', sourceHandle: 'received' }),
    link({ source: 'wait', target: 'expired', sourceHandle: 'expired' }),
    link({ source: 'split', target: 'register', sourceHandle: 'left' }),
    link({ source: 'split', target: 'notify', sourceHandle: 'right' }),
    link({ source: 'register', target: 'registered' }),
    link({ source: 'failure', target: 'manual' }),
    link({ source: 'manual', target: 'registered' }),
    link({ source: 'registered', target: 'sync' }),
    link({ source: 'notify', target: 'sync' }),
    link({ source: 'sync', target: 'close' }),
    link({ source: 'close', target: 'done' }),
  ],
};

function withEdges(graph: Graph, edges: Graph['edges']): Graph {
  return { nodes: graph.nodes, edges };
}

describe('findIssues', () => {
  it('não aponta nada no processo de exemplo nem no fluxo de referência', () => {
    expect(findIssues(sampleProcess)).toEqual([]);
    expect(findIssues(referenceProcess)).toEqual([]);
  });

  it('aponta processo sem Início, inclusive vazio', () => {
    expect(findIssues({ nodes: [], edges: [] })).toEqual([
      {
        key: 'missing-start',
        severity: 'error',
        message: 'O processo não tem um bloco Início.',
      },
    ]);
  });

  it('sem Início, não repete "inalcançável" em cada bloco', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'task', type: 'task' }),
        block({ id: 'end', type: 'end', data: { outcome: 'completed' } }),
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
        block({ id: 'end', type: 'end', data: { outcome: 'completed' } }),
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
        block({ id: 'start', type: 'start', data: { label: '' } }),
        block({ id: 'task', type: 'task', data: { label: '' } }),
      ],
      edges: [],
    };
    const issues = findIssues(graph);

    expect(issues.map((issue) => issue.message)).toEqual([
      'Início não tem conexão de saída.',
      'Etapa não tem conexão de entrada.',
      'Etapa não tem conexão de saída.',
    ]);
  });

  it('aponta convergência, junção e sincronização com uma só entrada', () => {
    const graph = withEdges(referenceProcess, [
      ...referenceProcess.edges.filter((edge) => edge.id !== 'notify-out-sync'),
    ]);

    expect(keys(graph)).toContain('few-inputs:sync');
  });

  it('aponta decisão com menos de dois ramos e cada ramo sem conexão', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'start', type: 'start' }),
        block({
          id: 'only',
          type: 'inclusive-split',
          data: { label: '', branches: [{ id: 'a', label: 'Único' }] },
        }),
      ],
      edges: [link({ source: 'start', target: 'only' })],
    };
    const issues = findIssues(graph);

    expect(issues.map((issue) => issue.key)).toEqual([
      'branch-unlinked:only:a',
      'few-branches:only',
    ]);
    expect(issues[0]).toMatchObject({
      branchId: 'a',
      message: 'Decisão inclusiva: o ramo "Único" não está conectado.',
    });
  });

  it('aponta a saída de prazo expirado sem conexão', () => {
    const graph = withEdges(
      referenceProcess,
      referenceProcess.edges.filter(
        (edge) => edge.id !== 'wait-expired-expired',
      ),
    );
    const issues = findIssues(graph);

    expect(issues).toContainEqual(
      expect.objectContaining({
        key: 'port-unlinked:expired:wait',
        message: 'wait: a saída "Prazo expirado" não está conectada.',
      }),
    );
  });

  it('aponta exceção solta ou presa a um bloco que não aceita exceção', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'loose', type: 'exception' }),
        block({ id: 'step', type: 'task' }),
        attached(block({ id: 'onStep', type: 'exception' }), 'step'),
      ],
      edges: [],
    };

    expect(keys(graph)).toEqual(
      expect.arrayContaining([
        'detached-exception:loose',
        'detached-exception:onStep',
      ]),
    );
  });

  it('aponta bloco que não é alcançado a partir do Início', () => {
    const graph: Graph = {
      nodes: [
        ...sampleProcess.nodes,
        block({ id: 'island', type: 'task' }),
        block({ id: 'other', type: 'task' }),
      ],
      edges: [
        ...sampleProcess.edges,
        link({ source: 'island', target: 'other' }),
      ],
    };

    expect(keys(graph)).toContain('unreachable:other');
  });

  it('permite retorno com saída e aponta ciclo sem saída para um Fim', () => {
    expect(keys(referenceProcess)).not.toContain('no-exit:review');

    const trapped: Graph = {
      nodes: [
        block({ id: 'start', type: 'start' }),
        block({ id: 'again', type: 'merge' }),
        block({ id: 'work', type: 'task' }),
      ],
      edges: [
        link({ source: 'start', target: 'again' }),
        link({ source: 'again', target: 'work' }),
        link({ source: 'work', target: 'again' }),
      ],
    };

    expect(keys(trapped)).toEqual(['no-exit:again', 'no-exit:work']);
  });

  it('separa erros de avisos de operação', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'start', type: 'start' }),
        block({ id: 'person', type: 'human-task', data: { label: 'Aprovar' } }),
        block({ id: 'end', type: 'end', data: { outcome: 'completed' } }),
      ],
      edges: [
        link({ source: 'start', target: 'person' }),
        link({ source: 'person', target: 'end' }),
      ],
    };

    expect(findIssues(graph)).toEqual([
      {
        key: 'incomplete-role:person',
        nodeId: 'person',
        severity: 'warning',
        message: 'Aprovar não tem papel responsável.',
      },
    ]);
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
        block({ id: 'end', type: 'end', data: { outcome: 'completed' } }),
      ],
      edges: [
        link({ source: 'start', target: 'task' }),
        link({ source: 'task', target: 'end' }),
        link({ source: 'end', target: 'task' }),
      ],
    };

    expect(findIssues(graph)).toContainEqual({
      key: 'invalid-edge:end-out-task',
      edgeId: 'end-out-task',
      severity: 'error',
      message: 'Conexão inválida: o bloco de origem não tem saída.',
    });
  });
});

describe('findIssues nos pares de abertura e sincronização', () => {
  it('aponta sincronização sem abertura, com abertura errada e repetida', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'split', type: 'parallel-split', data: { branches: [] } }),
        block({ id: 'free', type: 'parallel-join' }),
        block({ id: 'wrong', type: 'parallel-join', data: { pairId: 'free' } }),
        block({
          id: 'first',
          type: 'parallel-join',
          data: { pairId: 'split' },
        }),
        block({
          id: 'second',
          type: 'parallel-join',
          data: { pairId: 'split' },
        }),
      ],
      edges: [],
    };

    expect(keys(graph)).toEqual(
      expect.arrayContaining([
        'missing-pair:free',
        'invalid-pair:wrong',
        'duplicate-pair:second',
      ]),
    );
  });

  it('identifica o ramo que encerra o processo antes da sincronização', () => {
    const graph = withEdges(referenceProcess, [
      ...referenceProcess.edges.filter((edge) => edge.id !== 'notify-out-sync'),
      link({ source: 'notify', target: 'done' }),
    ]);
    const issues = findIssues(graph);

    expect(issues).toContainEqual({
      key: 'ends-early:split:right',
      nodeId: 'split',
      branchId: 'right',
      severity: 'error',
      message: 'split: o ramo "Caminho 2" encerra o processo antes de sync.',
    });
  });

  it('identifica o ramo que volta à abertura antes de sincronizar', () => {
    const graph: Graph = {
      nodes: [...referenceProcess.nodes, block({ id: 'retry', type: 'merge' })],
      edges: [
        ...referenceProcess.edges
          .filter((edge) => edge.id !== 'complete-yes-split')
          .filter((edge) => edge.id !== 'notify-out-sync'),
        link({ source: 'complete', target: 'retry', sourceHandle: 'yes' }),
        link({ source: 'retry', target: 'split' }),
        link({ source: 'notify', target: 'retry' }),
      ],
    };

    expect(keys(graph)).toContain('loops-back:split:right');
  });

  it('identifica o ramo que não chega à sincronização', () => {
    const graph: Graph = {
      nodes: [
        ...referenceProcess.nodes,
        block({
          id: 'elsewhere',
          type: 'parallel-join',
          data: { pairId: 'x' },
        }),
      ],
      edges: [
        ...referenceProcess.edges.filter(
          (edge) => edge.id !== 'notify-out-sync',
        ),
        link({ source: 'notify', target: 'elsewhere' }),
      ],
    };

    expect(keys(graph)).toContain('misses-sync:split:right');
  });
});

describe('findIssues nos subprocessos', () => {
  it('resume os problemas do canvas interno no bloco do subprocesso', () => {
    const graph: Graph = {
      nodes: [
        block({ id: 'start', type: 'start' }),
        block({
          id: 'sub',
          type: 'subprocess',
          data: { label: 'Cobrança', process: { nodes: [], edges: [] } },
        }),
        block({ id: 'end', type: 'end', data: { outcome: 'completed' } }),
      ],
      edges: [
        link({ source: 'start', target: 'sub' }),
        link({ source: 'sub', target: 'end' }),
      ],
    };

    expect(findIssues(graph)).toEqual([
      {
        key: 'inner-issues:sub',
        nodeId: 'sub',
        severity: 'error',
        message: 'Cobrança: o canvas interno tem 1 problema.',
      },
    ]);
  });
});

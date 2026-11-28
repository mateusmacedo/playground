import type { Graph } from './blocks';
import type { ProcessDocument } from './document';
import { parseDocument, serializeDocument } from './draft';
import { block, decisionBranches, link } from './test-graph';

const inner: Graph = {
  nodes: [
    { ...block({ id: 'in-start', type: 'start' }), selected: true },
    block({ id: 'in-end', type: 'end' }),
  ],
  edges: [link({ source: 'in-start', target: 'in-end' })],
};

const document: ProcessDocument = {
  version: 2,
  lanes: [{ id: 'sales', name: 'Vendas', width: 256 }],
  graph: {
    nodes: [
      {
        ...block({
          id: 'decision',
          type: 'decision',
          data: { branches: decisionBranches, laneId: 'sales' },
        }),
        position: { x: 32, y: 64 },
        selected: true,
      },
      block({ id: 'sub', type: 'subprocess', data: { process: inner } }),
      { ...block({ id: 'failure', type: 'exception' }), parentId: 'sub' },
    ],
    edges: [
      {
        ...link({ source: 'decision', target: 'sub', sourceHandle: 'yes' }),
        selected: true,
      },
    ],
  },
};

describe('serializeDocument e parseDocument', () => {
  it('reabre o documento com raias, posições, dados, ramos, exceções e subprocessos', () => {
    const reopened = parseDocument(serializeDocument(document));

    expect(reopened?.document.lanes).toEqual(document.lanes);
    expect(reopened?.document.graph.nodes[0]).toEqual({
      id: 'decision',
      type: 'decision',
      position: { x: 32, y: 64 },
      data: { label: 'decision', branches: decisionBranches, laneId: 'sales' },
    });
    expect(reopened?.document.graph.nodes[2]?.parentId).toBe('sub');
    expect(reopened?.document.graph.nodes[1]?.data.process?.nodes).toHaveLength(
      2,
    );
    expect(reopened?.document.graph.edges[0]).toEqual({
      id: 'decision-yes-sub',
      source: 'decision',
      target: 'sub',
      sourceHandle: 'yes',
      targetHandle: 'in',
    });
  });

  it('não salva o que é só da tela, nem dentro do subprocesso', () => {
    const text = serializeDocument(document);

    expect(text).not.toContain('selected');
  });

  it('recusa texto que não é um rascunho desta versão', () => {
    expect(parseDocument('não é json')).toBeNull();
    expect(
      parseDocument('{"version":3,"lanes":[],"graph":{"nodes":[],"edges":[]}}'),
    ).toBeNull();
    expect(
      parseDocument(
        '{"version":1,"lanes":[{}],"graph":{"nodes":[],"edges":[]}}',
      ),
    ).toBeNull();
    expect(
      parseDocument(
        '{"version":1,"lanes":[],"graph":{"nodes":[{"id":"a","position":{"x":0,"y":0},"data":{}}],"edges":[]}}',
      ),
    ).toBeNull();
  });
});

describe('ciclo salvar e reabrir das atividades feitas por uma pessoa', () => {
  const fields = [
    { id: 'amount', label: 'Valor', type: 'number', required: true },
    {
      id: 'origin',
      label: 'Origem',
      type: 'choice',
      required: false,
      options: ['Loja', 'Site'],
    },
  ] as const;

  const people: ProcessDocument = {
    version: 2,
    lanes: [{ id: 'sales', name: 'Vendas', width: 256 }],
    graph: {
      nodes: [
        block({
          id: 'review',
          type: 'human-task',
          data: { laneId: 'sales', role: 'Vendas', fields },
        }),
        block({
          id: 'free',
          type: 'human-task',
          data: { role: 'Analista de crédito' },
        }),
        block({
          id: 'ok',
          type: 'approval',
          data: {
            role: 'Diretoria',
            instructions: 'Confira o orçamento.',
            dueIn: { amount: 2, unit: 'days' },
            fields: [
              {
                id: 'draft',
                label: '',
                type: 'choice',
                required: false,
                options: [],
              },
            ],
          },
        }),
      ],
      edges: [
        link({ source: 'review', target: 'ok' }),
        link({ source: 'ok', target: 'free', sourceHandle: 'approved' }),
      ],
    },
  };

  it('devolve igual o responsável da Tarefa humana, na raia ou digitado', () => {
    const reopened = parseDocument(serializeDocument(people));
    const [review, free] = reopened?.document.graph.nodes ?? [];

    expect(review?.data).toMatchObject({ laneId: 'sales', role: 'Vendas' });
    expect(free?.data.role).toBe('Analista de crédito');
    expect(reopened?.adjusted).toBe(0);
  });

  it('devolve igual a Aprovação: tipo, papel aprovador, instruções, prazo e conexões dos pareceres', () => {
    const reopened = parseDocument(serializeDocument(people));

    expect(reopened?.document.graph.nodes[2]).toEqual(people.graph.nodes[2]);
    expect(reopened?.document.graph.edges[1]).toMatchObject({
      source: 'ok',
      sourceHandle: 'approved',
      target: 'free',
    });
  });

  it('devolve iguais os campos a preencher, inclusive o que ficou pela metade', () => {
    const reopened = parseDocument(serializeDocument(people));
    const [review, , approval] = reopened?.document.graph.nodes ?? [];

    expect(review?.data.fields).toEqual(fields);
    expect(approval?.data.fields).toEqual([
      { id: 'draft', label: '', type: 'choice', required: false, options: [] },
    ]);
  });
});

describe('parseDocument com rascunho da versão 1', () => {
  it('converte os valores em texto e informa quantos foram ajustados', () => {
    const legacy = JSON.stringify({
      version: 1,
      lanes: [],
      graph: {
        nodes: [
          {
            id: 'wait',
            type: 'wait-event',
            position: { x: 0, y: 0 },
            data: { label: 'Resposta', deadline: '48 horas' },
          },
          {
            id: 'end',
            type: 'end',
            position: { x: 0, y: 100 },
            data: { label: 'Fim', outcome: 'Expirado' },
          },
        ],
        edges: [],
      },
    });

    const reading = parseDocument(legacy);

    expect(reading?.document.version).toBe(2);
    expect(reading?.document.graph.nodes[0]?.data.deadline).toEqual({
      amount: 48,
      unit: 'hours',
    });
    expect(reading?.document.graph.nodes[1]?.data.outcome).toBe('expired');
    expect(reading?.adjusted).toBe(2);
  });
});

describe('parseDocument em estruturas quebradas', () => {
  function documentWith(graph: unknown): string {
    return JSON.stringify({ version: 2, lanes: [], graph });
  }

  it('lê o rótulo da conexão e recusa conexão ou bloco sem os campos mínimos', () => {
    const node = { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } };
    const labelled = parseDocument(
      documentWith({
        nodes: [node],
        edges: [
          { id: 'e', source: 'a', target: 'a', data: { label: 'volta' } },
        ],
      }),
    );

    expect(labelled?.document.graph.edges[0]).toMatchObject({
      data: { label: 'volta' },
      sourceHandle: null,
    });
    expect(
      parseDocument(documentWith({ nodes: [node], edges: [{ id: 'e' }] })),
    ).toBeNull();
    expect(
      parseDocument(
        documentWith({ nodes: [{ id: 'a', data: { label: 'A' } }], edges: [] }),
      ),
    ).toBeNull();
    expect(
      parseDocument(
        documentWith({
          nodes: [{ ...node, data: { label: 'A', process: { nodes: 'x' } } }],
          edges: [],
        }),
      ),
    ).toBeNull();
    expect(parseDocument(documentWith('grafo'))).toBeNull();
  });
});

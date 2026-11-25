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
  version: 1,
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

    expect(reopened?.lanes).toEqual(document.lanes);
    expect(reopened?.graph.nodes[0]).toEqual({
      id: 'decision',
      type: 'decision',
      position: { x: 32, y: 64 },
      data: { label: 'decision', branches: decisionBranches, laneId: 'sales' },
    });
    expect(reopened?.graph.nodes[2]?.parentId).toBe('sub');
    expect(reopened?.graph.nodes[1]?.data.process?.nodes).toHaveLength(2);
    expect(reopened?.graph.edges[0]).toEqual({
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
      parseDocument('{"version":2,"lanes":[],"graph":{"nodes":[],"edges":[]}}'),
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

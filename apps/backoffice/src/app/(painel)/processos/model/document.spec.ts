import type { GraphNode } from './blocks';
import {
  addLane,
  assignLane,
  LANE_WIDTH,
  type Lane,
  laneAtBlock,
  laneBands,
  moveLane,
  type ProcessDocument,
  renameLane,
  syncLanesFromPosition,
} from './document';
import { block } from './test-graph';

const lanes: Lane[] = [
  { id: 'sales', name: 'Vendas', width: LANE_WIDTH },
  { id: 'finance', name: 'Financeiro', width: LANE_WIDTH },
];

function at(node: GraphNode, x: number): GraphNode {
  return { ...node, position: { x, y: 100 } };
}

const document: ProcessDocument = {
  version: 1,
  lanes,
  graph: {
    nodes: [
      at(
        block({
          id: 'review',
          type: 'human-task',
          data: { laneId: 'sales', role: 'Vendas' },
        }),
        64,
      ),
      at(
        block({
          id: 'charge',
          type: 'automated-task',
          data: { laneId: 'finance' },
        }),
        320,
      ),
      at(block({ id: 'free', type: 'task' }), 800),
    ],
    edges: [],
  },
};

function nodeOf(source: ProcessDocument, id: string): GraphNode | undefined {
  return source.graph.nodes.find((node) => node.id === id);
}

describe('geometria das raias', () => {
  it('põe as raias lado a lado na ordem da lista', () => {
    expect(laneBands(lanes).map((band) => band.left)).toEqual([0, LANE_WIDTH]);
  });

  it('acha a raia pelo centro do bloco', () => {
    expect(laneAtBlock({ lanes, x: 64 })?.id).toBe('sales');
    expect(laneAtBlock({ lanes, x: 320 })?.id).toBe('finance');
    expect(laneAtBlock({ lanes, x: 800 })).toBeUndefined();
  });
});

describe('addLane', () => {
  it('cria a raia no fim com nome provisório', () => {
    const result = addLane({ document, createId: () => 'ops' });

    expect(result.lanes.at(-1)).toEqual({
      id: 'ops',
      name: 'Raia 3',
      width: LANE_WIDTH,
    });
  });
});

describe('renameLane', () => {
  it('renomeia e atualiza o papel das tarefas humanas da raia', () => {
    const result = renameLane({ document, laneId: 'sales', name: 'Comercial' });

    expect(result.lanes[0]?.name).toBe('Comercial');
    expect(nodeOf(result, 'review')?.data.role).toBe('Comercial');
  });

  it('ignora raia que não existe', () => {
    expect(renameLane({ document, laneId: 'x', name: 'Y' })).toBe(document);
  });
});

describe('moveLane', () => {
  it('troca a raia com a vizinha e leva os blocos junto', () => {
    const result = moveLane({
      document,
      laneId: 'finance',
      direction: 'before',
    });

    expect(result.lanes.map((lane) => lane.id)).toEqual(['finance', 'sales']);
    expect(nodeOf(result, 'charge')?.position.x).toBe(320 - LANE_WIDTH);
    expect(nodeOf(result, 'review')?.position.x).toBe(64 + LANE_WIDTH);
    expect(nodeOf(result, 'free')?.position.x).toBe(800);
  });

  it('não move além das pontas', () => {
    expect(moveLane({ document, laneId: 'sales', direction: 'before' })).toBe(
      document,
    );
  });
});

describe('assignLane', () => {
  it('leva a tarefa humana para a raia e troca o responsável', () => {
    const result = assignLane({
      document,
      nodeId: 'review',
      laneId: 'finance',
    });
    const review = nodeOf(result, 'review');

    expect(review?.data).toMatchObject({
      laneId: 'finance',
      role: 'Financeiro',
    });
    expect(laneAtBlock({ lanes, x: review?.position.x ?? 0 })?.id).toBe(
      'finance',
    );
  });
});

describe('syncLanesFromPosition', () => {
  it('atualiza a raia dos blocos movidos pela posição em que caíram', () => {
    const moved: ProcessDocument = {
      ...document,
      graph: {
        ...document.graph,
        nodes: document.graph.nodes.map((node) =>
          node.id === 'review' ? at(node, 320) : node,
        ),
      },
    };

    const result = syncLanesFromPosition({
      document: moved,
      nodeIds: ['review'],
    });

    expect(nodeOf(result, 'review')?.data).toMatchObject({
      laneId: 'finance',
      role: 'Financeiro',
    });
  });

  it('tira a raia do bloco que saiu de todas as colunas', () => {
    const result = syncLanesFromPosition({
      document: {
        ...document,
        graph: {
          ...document.graph,
          nodes: document.graph.nodes.map((node) =>
            node.id === 'charge' ? at(node, 900) : node,
          ),
        },
      },
      nodeIds: ['charge'],
    });

    expect(nodeOf(result, 'charge')?.data.laneId).toBeUndefined();
  });

  it('devolve o mesmo documento quando nada muda', () => {
    expect(syncLanesFromPosition({ document, nodeIds: ['review'] })).toBe(
      document,
    );
  });
});

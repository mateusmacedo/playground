import type { GraphNode } from './blocks';
import {
  addLane,
  assignLane,
  LANE_HEIGHT,
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
  { id: 'sales', name: 'Vendas', height: LANE_HEIGHT },
  { id: 'finance', name: 'Financeiro', height: LANE_HEIGHT },
];

function at(node: GraphNode, y: number): GraphNode {
  return { ...node, position: { x: 100, y } };
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
        256,
      ),
      at(block({ id: 'free', type: 'task' }), 600),
    ],
    edges: [],
  },
};

function nodeOf(source: ProcessDocument, id: string): GraphNode | undefined {
  return source.graph.nodes.find((node) => node.id === id);
}

describe('geometria das raias', () => {
  it('empilha as raias na ordem da lista', () => {
    expect(laneBands(lanes).map((band) => band.top)).toEqual([0, LANE_HEIGHT]);
  });

  it('acha a raia pelo centro do bloco', () => {
    expect(laneAtBlock({ lanes, y: 64 })?.id).toBe('sales');
    expect(laneAtBlock({ lanes, y: 256 })?.id).toBe('finance');
    expect(laneAtBlock({ lanes, y: 600 })).toBeUndefined();
  });
});

describe('addLane', () => {
  it('cria a raia no fim com nome provisório', () => {
    const result = addLane({ document, createId: () => 'ops' });

    expect(result.lanes.at(-1)).toEqual({
      id: 'ops',
      name: 'Raia 3',
      height: LANE_HEIGHT,
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
    const result = moveLane({ document, laneId: 'finance', direction: 'up' });

    expect(result.lanes.map((lane) => lane.id)).toEqual(['finance', 'sales']);
    expect(nodeOf(result, 'charge')?.position.y).toBe(256 - LANE_HEIGHT);
    expect(nodeOf(result, 'review')?.position.y).toBe(64 + LANE_HEIGHT);
    expect(nodeOf(result, 'free')?.position.y).toBe(600);
  });

  it('não move além das pontas', () => {
    expect(moveLane({ document, laneId: 'sales', direction: 'up' })).toBe(
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
    expect(laneAtBlock({ lanes, y: review?.position.y ?? 0 })?.id).toBe(
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
          node.id === 'review' ? at(node, 256) : node,
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

  it('tira a raia do bloco que saiu de todas as faixas', () => {
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

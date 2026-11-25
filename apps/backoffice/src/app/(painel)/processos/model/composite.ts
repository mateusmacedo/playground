import {
  type BlockKind,
  type Graph,
  type GraphNode,
  INPUT_HANDLE,
  kindOf,
  PAIRED_SPLIT,
  type Point,
} from './blocks';
import { type ConnectionRequest, connectionProblem } from './connections';
import { type LabeledEdge, unselected } from './editing';
import { BLOCK_SIZE, snapToGrid } from './geometry';
import { outputHandles } from './ports';

/** Distância entre exceções presas à mesma tarefa, ao longo da borda inferior dela. */
const EXCEPTION_SPACING = 40;

/** Afastamento lateral do bloco inserido, para ele não cair em cima das pontas da conexão. */
const INSERT_SIDE_GAP = BLOCK_SIZE.width + 48;

interface BesideParams {
  readonly source: Point;
  readonly target: Point;
}

/** Ao lado do meio da conexão, na grade. */
function besideMidpoint({ source, target }: BesideParams): Point {
  return {
    x: snapToGrid((source.x + target.x) / 2 + INSERT_SIDE_GAP),
    y: snapToGrid((source.y + target.y) / 2),
  };
}

interface ConnectionsValidParams<N extends GraphNode> {
  readonly graph: Graph<N, LabeledEdge>;
  readonly connections: readonly LabeledEdge[];
}

function connectionIsValid<N extends GraphNode>(
  params: ConnectionsValidParams<N>,
): boolean {
  const { graph, connections } = params;
  for (const connection of connections) {
    const problem = connectionProblem({
      graph,
      connection,
      ignoreEdgeId: connection.id,
    });
    if (problem !== null) {
      return false;
    }
  }
  return true;
}

export interface InsertOnEdgeParams<N extends GraphNode> {
  readonly graph: Graph<N, LabeledEdge>;
  readonly edgeId: string;
  /** Bloco novo; ele vai para o lado do meio da conexão. */
  readonly block: N;
  readonly createId: () => string;
}

/**
 * Divide a conexão e põe o bloco no meio, num passo só. O trecho que sai da origem mantém o id, o ramo e o rótulo da
 * conexão original; o bloco sai pela primeira saída dele até o destino antigo.
 */
export function insertOnEdge<N extends GraphNode>(
  params: InsertOnEdgeParams<N>,
): Graph<N, LabeledEdge> {
  const { graph, edgeId, block, createId } = params;
  const edge = graph.edges.find((candidate) => candidate.id === edgeId);
  const source = graph.nodes.find((node) => node.id === edge?.source);
  const target = graph.nodes.find((node) => node.id === edge?.target);
  const [firstOutput] = outputHandles(block);
  if (!edge || !source || !target || firstOutput === undefined) {
    return graph;
  }
  const placed: N = {
    ...block,
    position: besideMidpoint({
      source: source.position,
      target: target.position,
    }),
    selected: true,
  };
  const incoming: LabeledEdge = {
    ...edge,
    target: placed.id,
    targetHandle: INPUT_HANDLE,
    selected: false,
  };
  const outgoing: LabeledEdge = {
    id: createId(),
    source: placed.id,
    sourceHandle: firstOutput,
    target: edge.target,
    targetHandle: edge.targetHandle ?? INPUT_HANDLE,
  };
  const edges: LabeledEdge[] = [];
  for (const candidate of unselected(graph.edges)) {
    edges.push(candidate.id === edgeId ? incoming : candidate);
  }
  edges.push(outgoing);
  const result = { nodes: [...unselected(graph.nodes), placed], edges };
  const valid = connectionIsValid({
    graph: result,
    connections: [incoming, outgoing],
  });
  return valid ? result : graph;
}

export interface ConnectNewBlockParams<N extends GraphNode> {
  readonly graph: Graph<N, LabeledEdge>;
  readonly connection: Omit<ConnectionRequest, 'target'>;
  readonly block: N;
  readonly createId: () => string;
}

/** Cria o bloco já ligado à saída de onde a conexão foi solta; só entra se a ligação for válida. */
export function connectNewBlock<N extends GraphNode>(
  params: ConnectNewBlockParams<N>,
): Graph<N, LabeledEdge> {
  const { graph, connection, block, createId } = params;
  const edge: LabeledEdge = {
    id: createId(),
    source: connection.source,
    sourceHandle: connection.sourceHandle ?? null,
    target: block.id,
    targetHandle: INPUT_HANDLE,
  };
  const result = {
    nodes: [...unselected(graph.nodes), { ...block, selected: true }],
    edges: [...unselected(graph.edges), edge],
  };
  return connectionIsValid({ graph: result, connections: [edge] })
    ? result
    : graph;
}

export interface AttachExceptionParams<N extends GraphNode> {
  readonly graph: Graph<N, LabeledEdge>;
  readonly taskId: string;
  /** Evento de exceção novo, que fica preso à borda inferior da tarefa. */
  readonly block: N;
}

/** Prende uma exceção nova à tarefa, ao lado das que ela já tem. */
export function attachException<N extends GraphNode>(
  params: AttachExceptionParams<N>,
): Graph<N, LabeledEdge> {
  const { graph, taskId, block } = params;
  const task = graph.nodes.find((node) => node.id === taskId);
  if (!task || kindOf(block) !== 'exception') {
    return graph;
  }
  const siblings = graph.nodes.filter((node) => node.parentId === taskId);
  const attached: N = {
    ...block,
    parentId: taskId,
    position: {
      x: BLOCK_SIZE.width - EXCEPTION_SPACING * (siblings.length + 1),
      y: BLOCK_SIZE.height - 16,
    },
    selected: true,
  };
  return {
    nodes: [...unselected(graph.nodes), attached],
    edges: unselected(graph.edges),
  };
}

export interface SuggestedPairParams {
  readonly graph: Graph;
  readonly kind: BlockKind;
}

/** Abertura para uma sincronização ou junção nova: a única do tipo certo que ainda não tem par, se houver. */
export function suggestedPairId(
  params: SuggestedPairParams,
): string | undefined {
  const { graph, kind } = params;
  const splitKind = PAIRED_SPLIT[kind];
  if (splitKind === undefined) {
    return undefined;
  }
  const claimed = new Set<string>();
  for (const node of graph.nodes) {
    if (node.data.pairId !== undefined) {
      claimed.add(node.data.pairId);
    }
  }
  const free = graph.nodes.filter(
    (node) => kindOf(node) === splitKind && !claimed.has(node.id),
  );
  const [only] = free;
  return free.length === 1 ? only?.id : undefined;
}

export interface WithSuggestedPairParams<N extends GraphNode> {
  readonly graph: Graph;
  readonly block: N;
}

/** O bloco novo, já apontando para a abertura sugerida quando ele é uma sincronização ou junção. */
export function withSuggestedPair<N extends GraphNode>(
  params: WithSuggestedPairParams<N>,
): N {
  const { graph, block } = params;
  const pairId = suggestedPairId({ graph, kind: kindOf(block) });
  if (pairId === undefined) {
    return block;
  }
  return { ...block, data: { ...block.data, pairId } };
}

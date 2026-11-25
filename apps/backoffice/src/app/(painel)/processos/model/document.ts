import { type Graph, type GraphEdge, type GraphNode, kindOf } from './blocks';
import { BLOCK_SIZE, snapToGrid } from './geometry';

/** Faixa horizontal de um papel responsável; as raias se empilham a partir de y = 0, na ordem da lista. */
export interface Lane {
  readonly id: string;
  readonly name: string;
  readonly height: number;
}

/** Tudo o que o editor salva e desfaz: as raias e o grafo do nível raiz (os subprocessos vão dentro dele). */
export interface ProcessDocument<
  N extends GraphNode = GraphNode,
  E extends GraphEdge = GraphEdge,
> {
  readonly version: 1;
  readonly lanes: readonly Lane[];
  readonly graph: Graph<N, E>;
}

export const LANE_HEIGHT = 192;

export interface LaneBand {
  readonly lane: Lane;
  readonly top: number;
}

/** Cada raia com o topo dela no canvas. */
export function laneBands(lanes: readonly Lane[]): LaneBand[] {
  const bands: LaneBand[] = [];
  let top = 0;
  for (const lane of lanes) {
    bands.push({ lane, top });
    top += lane.height;
  }
  return bands;
}

export interface LaneAtBlockParams {
  readonly lanes: readonly Lane[];
  readonly y: number;
}

/** Raia que contém o centro de um bloco posicionado em `y`, se houver. */
export function laneAtBlock(params: LaneAtBlockParams): Lane | undefined {
  const center = params.y + BLOCK_SIZE.height / 2;
  for (const band of laneBands(params.lanes)) {
    const bottom = band.top + band.lane.height;
    if (center >= band.top && center < bottom) {
      return band.lane;
    }
  }
  return undefined;
}

interface DocumentParams<N extends GraphNode, E extends GraphEdge> {
  readonly document: ProcessDocument<N, E>;
}

export interface AddLaneParams<N extends GraphNode, E extends GraphEdge>
  extends DocumentParams<N, E> {
  readonly createId: () => string;
}

/** Raia nova no fim da lista, com nome provisório. */
export function addLane<N extends GraphNode, E extends GraphEdge>(
  params: AddLaneParams<N, E>,
): ProcessDocument<N, E> {
  const { document, createId } = params;
  const lane: Lane = {
    id: createId(),
    name: `Raia ${document.lanes.length + 1}`,
    height: LANE_HEIGHT,
  };
  return { ...document, lanes: [...document.lanes, lane] };
}

interface AssignRoleParams<N extends GraphNode> {
  readonly node: N;
  readonly lane: Lane;
}

/** O bloco dentro da raia; a Tarefa humana passa a ter o papel da raia como responsável. */
function withLane<N extends GraphNode>(params: AssignRoleParams<N>): N {
  const { node, lane } = params;
  const data =
    kindOf(node) === 'human-task'
      ? { ...node.data, laneId: lane.id, role: lane.name }
      : { ...node.data, laneId: lane.id };
  return { ...node, data };
}

export interface RenameLaneParams<N extends GraphNode, E extends GraphEdge>
  extends DocumentParams<N, E> {
  readonly laneId: string;
  readonly name: string;
}

/** Renomeia a raia e atualiza o papel das Tarefas humanas dentro dela. */
export function renameLane<N extends GraphNode, E extends GraphEdge>(
  params: RenameLaneParams<N, E>,
): ProcessDocument<N, E> {
  const { document, laneId, name } = params;
  const current = document.lanes.find((lane) => lane.id === laneId);
  if (!current) {
    return document;
  }
  const lane = { ...current, name };
  const lanes = document.lanes.map((candidate) =>
    candidate.id === laneId ? lane : candidate,
  );
  const nodes: N[] = [];
  for (const node of document.graph.nodes) {
    if (node.data.laneId === laneId) {
      nodes.push(withLane({ node, lane }));
    } else {
      nodes.push(node);
    }
  }
  return { ...document, lanes, graph: { ...document.graph, nodes } };
}

export type LaneDirection = 'up' | 'down';

export interface MoveLaneParams<N extends GraphNode, E extends GraphEdge>
  extends DocumentParams<N, E> {
  readonly laneId: string;
  readonly direction: LaneDirection;
}

interface ReorderedLanesParams {
  readonly lanes: readonly Lane[];
  readonly laneId: string;
  readonly direction: LaneDirection;
}

function reorderedLanes(params: ReorderedLanesParams): Lane[] | null {
  const { lanes, laneId, direction } = params;
  const index = lanes.findIndex((lane) => lane.id === laneId);
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  const lane = lanes[index];
  const neighbor = lanes[swapWith];
  if (index < 0 || lane === undefined || neighbor === undefined) {
    return null;
  }
  const result = [...lanes];
  result[index] = neighbor;
  result[swapWith] = lane;
  return result;
}

function topsById(lanes: readonly Lane[]): Map<string, number> {
  const tops = new Map<string, number>();
  for (const band of laneBands(lanes)) {
    tops.set(band.lane.id, band.top);
  }
  return tops;
}

/** Troca a raia de lugar com a vizinha; os blocos das duas acompanham as faixas. */
export function moveLane<N extends GraphNode, E extends GraphEdge>(
  params: MoveLaneParams<N, E>,
): ProcessDocument<N, E> {
  const { document } = params;
  const lanes = reorderedLanes({ ...params, lanes: document.lanes });
  if (lanes === null) {
    return document;
  }
  const oldTops = topsById(document.lanes);
  const newTops = topsById(lanes);
  const nodes: N[] = [];
  for (const node of document.graph.nodes) {
    const laneId = node.data.laneId;
    const oldTop = laneId === undefined ? undefined : oldTops.get(laneId);
    const newTop = laneId === undefined ? undefined : newTops.get(laneId);
    if (oldTop === undefined || newTop === undefined || node.parentId) {
      nodes.push(node);
      continue;
    }
    const position = {
      x: node.position.x,
      y: node.position.y + newTop - oldTop,
    };
    nodes.push({ ...node, position });
  }
  return { ...document, lanes, graph: { ...document.graph, nodes } };
}

export interface AssignLaneParams<N extends GraphNode, E extends GraphEdge>
  extends DocumentParams<N, E> {
  readonly nodeId: string;
  readonly laneId: string;
}

/** Leva o bloco para a raia: grava a raia, atualiza o responsável e, se estiver fora da faixa, centraliza nela. */
export function assignLane<N extends GraphNode, E extends GraphEdge>(
  params: AssignLaneParams<N, E>,
): ProcessDocument<N, E> {
  const { document, nodeId, laneId } = params;
  const band = laneBands(document.lanes).find(
    (candidate) => candidate.lane.id === laneId,
  );
  const node = document.graph.nodes.find(
    (candidate) => candidate.id === nodeId,
  );
  if (!band || !node || node.parentId) {
    return document;
  }
  let moved = withLane({ node, lane: band.lane });
  const inside = laneAtBlock({ lanes: document.lanes, y: node.position.y });
  if (inside?.id !== laneId) {
    const y = snapToGrid(band.top + (band.lane.height - BLOCK_SIZE.height) / 2);
    moved = { ...moved, position: { x: node.position.x, y } };
  }
  const nodes = document.graph.nodes.map((candidate) =>
    candidate.id === nodeId ? moved : candidate,
  );
  return { ...document, graph: { ...document.graph, nodes } };
}

export interface SyncLanesParams<N extends GraphNode, E extends GraphEdge>
  extends DocumentParams<N, E> {
  readonly nodeIds: readonly string[];
}

/** Depois de um arraste: cada bloco movido passa a pertencer à raia em que caiu (ou a nenhuma, fora das faixas). */
export function syncLanesFromPosition<N extends GraphNode, E extends GraphEdge>(
  params: SyncLanesParams<N, E>,
): ProcessDocument<N, E> {
  const { document, nodeIds } = params;
  if (document.lanes.length === 0) {
    return document;
  }
  let changed = false;
  const nodes: N[] = [];
  for (const node of document.graph.nodes) {
    const moved = nodeIds.includes(node.id) && !node.parentId;
    if (!moved) {
      nodes.push(node);
      continue;
    }
    const lane = laneAtBlock({ lanes: document.lanes, y: node.position.y });
    if (lane?.id === node.data.laneId) {
      nodes.push(node);
      continue;
    }
    changed = true;
    if (lane) {
      nodes.push(withLane({ node, lane }));
    } else {
      nodes.push({ ...node, data: { ...node.data, laneId: undefined } });
    }
  }
  if (!changed) {
    return document;
  }
  return { ...document, graph: { ...document.graph, nodes } };
}

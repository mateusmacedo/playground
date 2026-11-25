import type { Graph, GraphEdge, GraphNode, Point } from './blocks';
import { BLOCK_SIZE, snapToGrid } from './geometry';

export type AlignMode =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

/** Blocos que a organização move: os selecionados que não estão presos a outro (as exceções seguem a tarefa). */
function movable<N extends GraphNode>(nodes: readonly N[]): N[] {
  return nodes.filter((node) => node.selected && node.parentId === undefined);
}

interface Bounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function boundsOf(nodes: readonly GraphNode[]): Bounds {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    left = Math.min(left, node.position.x);
    right = Math.max(right, node.position.x + BLOCK_SIZE.width);
    top = Math.min(top, node.position.y);
    bottom = Math.max(bottom, node.position.y + BLOCK_SIZE.height);
  }
  return { left, right, top, bottom };
}

interface AlignedPositionParams {
  readonly position: Point;
  readonly bounds: Bounds;
  readonly mode: AlignMode;
}

function alignedPosition(params: AlignedPositionParams): Point {
  const { position, bounds, mode } = params;
  switch (mode) {
    case 'left':
      return { x: bounds.left, y: position.y };
    case 'right':
      return { x: bounds.right - BLOCK_SIZE.width, y: position.y };
    case 'center': {
      const center = (bounds.left + bounds.right) / 2;
      return { x: snapToGrid(center - BLOCK_SIZE.width / 2), y: position.y };
    }
    case 'top':
      return { x: position.x, y: bounds.top };
    case 'bottom':
      return { x: position.x, y: bounds.bottom - BLOCK_SIZE.height };
    case 'middle': {
      const middle = (bounds.top + bounds.bottom) / 2;
      return { x: position.x, y: snapToGrid(middle - BLOCK_SIZE.height / 2) };
    }
  }
}

interface WithPositionsParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly positions: ReadonlyMap<string, Point>;
}

function withPositions<N extends GraphNode, E extends GraphEdge>(
  params: WithPositionsParams<N, E>,
): Graph<N, E> {
  const { graph, positions } = params;
  let changed = false;
  const nodes: N[] = [];
  for (const node of graph.nodes) {
    const position = positions.get(node.id);
    const moved =
      position !== undefined &&
      (position.x !== node.position.x || position.y !== node.position.y);
    if (moved) {
      changed = true;
      nodes.push({ ...node, position });
    } else {
      nodes.push(node);
    }
  }
  return changed ? { nodes, edges: graph.edges } : graph;
}

export interface AlignParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly mode: AlignMode;
}

/** Alinha os blocos selecionados por uma borda ou pelo centro do conjunto; precisa de pelo menos dois. */
export function alignSelection<N extends GraphNode, E extends GraphEdge>(
  params: AlignParams<N, E>,
): Graph<N, E> {
  const { graph, mode } = params;
  const nodes = movable(graph.nodes);
  if (nodes.length < 2) {
    return graph;
  }
  const bounds = boundsOf(nodes);
  const positions = new Map<string, Point>();
  for (const node of nodes) {
    positions.set(
      node.id,
      alignedPosition({ position: node.position, bounds, mode }),
    );
  }
  return withPositions({ graph, positions });
}

export interface DistributeParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly axis: DistributeAxis;
}

/** Espaça igualmente os blocos selecionados entre o primeiro e o último no eixo; precisa de pelo menos três. */
export function distributeSelection<N extends GraphNode, E extends GraphEdge>(
  params: DistributeParams<N, E>,
): Graph<N, E> {
  const { graph, axis } = params;
  const nodes = movable(graph.nodes);
  if (nodes.length < 3) {
    return graph;
  }
  const coordinate = (node: GraphNode) =>
    axis === 'horizontal' ? node.position.x : node.position.y;
  const sorted = [...nodes].sort((a, b) => coordinate(a) - coordinate(b));
  const first = Math.min(...sorted.map(coordinate));
  const last = Math.max(...sorted.map(coordinate));
  const step = (last - first) / (sorted.length - 1);
  const positions = new Map<string, Point>();
  for (let index = 0; index < sorted.length; index += 1) {
    const node = sorted[index];
    if (node === undefined) {
      continue;
    }
    const value = snapToGrid(first + step * index);
    const position =
      axis === 'horizontal'
        ? { x: value, y: node.position.y }
        : { x: node.position.x, y: value };
    positions.set(node.id, position);
  }
  return withPositions({ graph, positions });
}

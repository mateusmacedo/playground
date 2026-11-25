import type {
  BlockData,
  Graph,
  GraphEdge,
  GraphNode,
  LinkData,
} from './blocks';
import type { Lane, ProcessDocument } from './document';

/** Nó como fica salvo: sem o que é só da tela (seleção, medidas, arraste). */
interface SavedNode {
  readonly id: string;
  readonly type?: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly data: BlockData;
  readonly parentId?: string;
}

interface SavedEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle: string | null;
  readonly targetHandle: string | null;
  readonly data?: LinkData;
}

interface EdgeWithData extends GraphEdge {
  readonly data?: LinkData;
}

function savedNode(node: GraphNode): SavedNode {
  const process = node.data.process;
  const data =
    process === undefined
      ? node.data
      : { ...node.data, process: savedGraph(process) };
  const saved: SavedNode = {
    id: node.id,
    type: node.type,
    position: { x: node.position.x, y: node.position.y },
    data,
  };
  return node.parentId === undefined
    ? saved
    : { ...saved, parentId: node.parentId };
}

function savedEdge(edge: EdgeWithData): SavedEdge {
  const saved: SavedEdge = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
  };
  return edge.data === undefined ? saved : { ...saved, data: edge.data };
}

function savedGraph(graph: Graph<GraphNode, EdgeWithData>): Graph {
  return {
    nodes: graph.nodes.map(savedNode),
    edges: graph.edges.map(savedEdge),
  };
}

/** Texto do rascunho: o documento inteiro, inclusive os subprocessos, sem estado de tela. */
export function serializeDocument(
  document: ProcessDocument<GraphNode, EdgeWithData>,
): string {
  return JSON.stringify({
    version: document.version,
    lanes: document.lanes,
    graph: savedGraph(document.graph),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string';
}

function isPoint(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number'
  );
}

function isLane(value: unknown): value is Lane {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.name) &&
    typeof value.width === 'number'
  );
}

function isNode(value: unknown): value is GraphNode {
  if (!isRecord(value) || !isText(value.id) || !isPoint(value.position)) {
    return false;
  }
  const data = value.data;
  if (!isRecord(data) || !isText(data.label)) {
    return false;
  }
  return data.process === undefined || isGraph(data.process);
}

function isEdge(value: unknown): value is GraphEdge {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.source) &&
    isText(value.target)
  );
}

function isGraph(value: unknown): value is Graph {
  if (!isRecord(value)) {
    return false;
  }
  const { nodes, edges } = value;
  return (
    Array.isArray(nodes) &&
    Array.isArray(edges) &&
    nodes.every(isNode) &&
    edges.every(isEdge)
  );
}

/** Lê o rascunho; texto que não é um documento desta versão devolve `null`, e a tela abre o exemplo. */
export function parseDocument(text: string): ProcessDocument | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    // WHY: rascunho corrompido não é erro do usuário; quem chama mostra o aviso e abre o exemplo.
    return null;
  }
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }
  const { lanes, graph } = value;
  if (!Array.isArray(lanes) || !lanes.every(isLane) || !isGraph(graph)) {
    return null;
  }
  return { version: 1, lanes, graph };
}

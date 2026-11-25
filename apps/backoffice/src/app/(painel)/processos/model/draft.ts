import type {
  BlockData,
  Graph,
  GraphEdge,
  GraphNode,
  LinkData,
} from './blocks';
import { DOCUMENT_VERSION, type Lane, type ProcessDocument } from './document';
import { sanitizeBlockData } from './draft-fields';

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

function isPoint(value: unknown): value is { x: number; y: number } {
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

/** Contador de campos ajustados durante a leitura de um rascunho. */
interface Adjustments {
  count: number;
}

interface ReadParams {
  readonly value: unknown;
  readonly adjustments: Adjustments;
}

function readNode({ value, adjustments }: ReadParams): GraphNode | null {
  if (!isRecord(value) || !isText(value.id) || !isPoint(value.position)) {
    return null;
  }
  const raw = value.data;
  if (!isRecord(raw) || !isText(raw.label)) {
    return null;
  }
  let process: Graph | undefined;
  if (raw.process !== undefined) {
    const inner = readGraph({ value: raw.process, adjustments });
    if (inner === null) {
      return null;
    }
    process = inner;
  }
  const sanitized = sanitizeBlockData({ raw, label: raw.label });
  adjustments.count += sanitized.adjusted;
  const data =
    process === undefined ? sanitized.data : { ...sanitized.data, process };
  const node: GraphNode = {
    id: value.id,
    type: isText(value.type) ? value.type : undefined,
    position: { x: value.position.x, y: value.position.y },
    data,
  };
  return isText(value.parentId) ? { ...node, parentId: value.parentId } : node;
}

function readEdge(value: unknown): EdgeWithData | null {
  if (!isRecord(value)) {
    return null;
  }
  const { id, source, target } = value;
  if (!isText(id) || !isText(source) || !isText(target)) {
    return null;
  }
  const edge: EdgeWithData = {
    id,
    source,
    target,
    sourceHandle: isText(value.sourceHandle) ? value.sourceHandle : null,
    targetHandle: isText(value.targetHandle) ? value.targetHandle : null,
  };
  const label = isRecord(value.data) ? value.data.label : undefined;
  return isText(label) ? { ...edge, data: { label } } : edge;
}

function readGraph({ value, adjustments }: ReadParams): Graph | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  ) {
    return null;
  }
  const nodes: GraphNode[] = [];
  for (const item of value.nodes) {
    const node = readNode({ value: item, adjustments });
    if (node === null) {
      return null;
    }
    nodes.push(node);
  }
  const edges: EdgeWithData[] = [];
  for (const item of value.edges) {
    const edge = readEdge(item);
    if (edge === null) {
      return null;
    }
    edges.push(edge);
  }
  return { nodes, edges };
}

export interface DraftReading {
  readonly document: ProcessDocument;
  /** Campos que o rascunho tinha fora da regra (ou em texto da versão 1) e que foram convertidos ou removidos. */
  readonly adjusted: number;
}

/**
 * Lê o rascunho da versão 1 ou 2. Estrutura quebrada devolve `null`, e a tela abre o exemplo; campo inválido sai e
 * entra na contagem de ajustes, para a tela avisar.
 */
export function parseDocument(text: string): DraftReading | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    // WHY: rascunho corrompido não é erro do usuário; quem chama mostra o aviso e abre o exemplo.
    return null;
  }
  const knownVersion =
    isRecord(value) &&
    (value.version === 1 || value.version === DOCUMENT_VERSION);
  if (!isRecord(value) || !knownVersion) {
    return null;
  }
  const { lanes } = value;
  if (!Array.isArray(lanes) || !lanes.every(isLane)) {
    return null;
  }
  const adjustments: Adjustments = { count: 0 };
  const graph = readGraph({ value: value.graph, adjustments });
  if (graph === null) {
    return null;
  }
  const document: ProcessDocument = { version: DOCUMENT_VERSION, lanes, graph };
  return { document, adjusted: adjustments.count };
}

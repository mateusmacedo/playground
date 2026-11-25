import type {
  BlockData,
  Branch,
  Graph,
  GraphEdge,
  GraphNode,
  Point,
} from './blocks';
import { DUPLICATE_OFFSET, unselected } from './editing';

/** Trecho copiado: blocos e as conexões entre eles. */
export interface Clip<N extends GraphNode, E extends GraphEdge> {
  readonly nodes: readonly N[];
  readonly edges: readonly E[];
}

/** Os blocos selecionados, as exceções presas a eles e as conexões internas ao trecho; `null` sem bloco selecionado. */
export function copySelection<N extends GraphNode, E extends GraphEdge>(
  graph: Graph<N, E>,
): Clip<N, E> | null {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (node.selected) {
      ids.add(node.id);
    }
  }
  for (const node of graph.nodes) {
    if (node.parentId !== undefined && ids.has(node.parentId)) {
      ids.add(node.id);
    }
  }
  if (ids.size === 0) {
    return null;
  }
  const nodes = graph.nodes.filter((node) => ids.has(node.id));
  const edges = graph.edges.filter(
    (edge) => ids.has(edge.source) && ids.has(edge.target),
  );
  return { nodes, edges };
}

interface RemapDataParams {
  readonly data: BlockData;
  readonly nodeIds: ReadonlyMap<string, string>;
  readonly branchIds: Map<string, string>;
  readonly createId: () => string;
}

function remapBranches(params: RemapDataParams): Branch[] | undefined {
  const { data, branchIds, createId } = params;
  if (data.branches === undefined) {
    return undefined;
  }
  const branches: Branch[] = [];
  for (const branch of data.branches) {
    const id = createId();
    branchIds.set(branch.id, id);
    branches.push({ ...branch, id });
  }
  return branches;
}

/** Dados da cópia: ramos com ids novos e referências ao trecho (par, ramo padrão, canvas interno) remapeadas. */
function remapData(params: RemapDataParams): BlockData {
  const { data, nodeIds, branchIds, createId } = params;
  let copy: BlockData = { ...data };
  const branches = remapBranches(params);
  if (branches !== undefined) {
    copy = { ...copy, branches };
  }
  if (data.defaultBranchId !== undefined) {
    const defaultBranchId =
      branchIds.get(data.defaultBranchId) ?? data.defaultBranchId;
    copy = { ...copy, defaultBranchId };
  }
  if (data.pairId !== undefined) {
    // NOTE: par fora do trecho continua apontando para o original; só referência interna ganha o id da cópia.
    const pairId = nodeIds.get(data.pairId) ?? data.pairId;
    copy = { ...copy, pairId };
  }
  if (data.process !== undefined) {
    const process = cloneElements({
      nodes: data.process.nodes,
      edges: data.process.edges,
      createId,
      offset: { x: 0, y: 0 },
    });
    copy = { ...copy, process };
  }
  return copy;
}

interface CloneElementsParams<N extends GraphNode, E extends GraphEdge> {
  readonly nodes: readonly N[];
  readonly edges: readonly E[];
  readonly createId: () => string;
  readonly offset: Point;
}

interface NodeCopyParams<N extends GraphNode> {
  readonly node: N;
  readonly nodeIds: ReadonlyMap<string, string>;
  readonly branchIds: Map<string, string>;
  readonly createId: () => string;
  readonly offset: Point;
}

function copyNode<N extends GraphNode>(params: NodeCopyParams<N>): N {
  const { node, nodeIds, branchIds, createId, offset } = params;
  const id = nodeIds.get(node.id) ?? createId();
  const data = remapData({ data: node.data, nodeIds, branchIds, createId });
  if (node.parentId === undefined) {
    const position = {
      x: node.position.x + offset.x,
      y: node.position.y + offset.y,
    };
    return { ...node, id, data, position };
  }
  // NOTE: a posição da exceção é relativa à tarefa; ela só se desloca junto quando a tarefa também foi copiada.
  const parentInClip = nodeIds.get(node.parentId);
  const parentId = parentInClip ?? node.parentId;
  const position =
    parentInClip === undefined
      ? { x: node.position.x + offset.x, y: node.position.y + offset.y }
      : node.position;
  return { ...node, id, data, position, parentId };
}

/** Cópia de blocos e conexões com ids novos em tudo: blocos, ramos e conexões. */
function cloneElements<N extends GraphNode, E extends GraphEdge>(
  params: CloneElementsParams<N, E>,
): Clip<N, E> {
  const { nodes, edges, createId, offset } = params;
  const nodeIds = new Map<string, string>();
  for (const node of nodes) {
    nodeIds.set(node.id, createId());
  }
  const branchIdsByNode = new Map<string, Map<string, string>>();
  const nodeCopies: N[] = [];
  for (const node of nodes) {
    const branchIds = new Map<string, string>();
    branchIdsByNode.set(node.id, branchIds);
    nodeCopies.push(copyNode({ node, nodeIds, branchIds, createId, offset }));
  }
  const edgeCopies: E[] = [];
  for (const edge of edges) {
    const source = nodeIds.get(edge.source);
    const target = nodeIds.get(edge.target);
    if (source === undefined || target === undefined) {
      continue;
    }
    const handle = edge.sourceHandle ?? null;
    const branchIds = branchIdsByNode.get(edge.source);
    const sourceHandle =
      handle === null ? null : (branchIds?.get(handle) ?? handle);
    edgeCopies.push({ ...edge, id: createId(), source, target, sourceHandle });
  }
  return { nodes: nodeCopies, edges: edgeCopies };
}

export interface PasteClipParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly clip: Clip<N, E>;
  readonly createId: () => string;
  readonly offset?: Point;
}

/** Cola o trecho com ids novos, deslocado; a seleção passa para a cópia. */
export function pasteClip<N extends GraphNode, E extends GraphEdge>(
  params: PasteClipParams<N, E>,
): Graph<N, E> {
  const { graph, clip, createId, offset = DUPLICATE_OFFSET } = params;
  if (clip.nodes.length === 0) {
    return graph;
  }
  const copy = cloneElements({
    nodes: clip.nodes,
    edges: clip.edges,
    createId,
    offset,
  });
  const nodeCopies: N[] = [];
  for (const node of copy.nodes) {
    nodeCopies.push({ ...node, selected: true });
  }
  return {
    nodes: [...unselected(graph.nodes), ...nodeCopies],
    edges: [...unselected(graph.edges), ...copy.edges],
  };
}

export interface DuplicateSelectionParams<
  N extends GraphNode,
  E extends GraphEdge,
> {
  readonly graph: Graph<N, E>;
  readonly createId: () => string;
}

/** Copia e cola a seleção num passo só, deslocada em 40px. */
export function duplicateSelection<N extends GraphNode, E extends GraphEdge>(
  params: DuplicateSelectionParams<N, E>,
): Graph<N, E> {
  const { graph, createId } = params;
  const clip = copySelection(graph);
  if (clip === null) {
    return graph;
  }
  return pasteClip({ graph, clip, createId });
}

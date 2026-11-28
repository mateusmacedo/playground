import { nextBranchLabel } from './block-factory';
import type {
  BlockData,
  Branch,
  Graph,
  GraphEdge,
  GraphNode,
  LinkData,
  Point,
} from './blocks';
import {
  type ConnectionRequest,
  connectionProblem,
  sourceHandleOf,
} from './connections';
import { outputHandles } from './ports';

/** Deslocamento da cópia em relação ao original, para as duas não ficarem sobrepostas. */
export const DUPLICATE_OFFSET: Point = { x: 40, y: 40 };

export interface Selectable {
  readonly selected?: boolean;
}

/** Os mesmos itens com a seleção desfeita; quem já não estava selecionado mantém a referência. */
export function unselected<T extends Selectable>(items: readonly T[]): T[] {
  const result: T[] = [];
  for (const item of items) {
    if (item.selected) {
      result.push({ ...item, selected: false });
    } else {
      result.push(item);
    }
  }
  return result;
}

/** Conexão que pode levar um rótulo digitado. */
export interface LabeledEdge extends GraphEdge {
  readonly data?: LinkData;
}

/** Ids dos blocos selecionados e das exceções presas a eles, que não existem sem a tarefa. */
function removedNodeIds(nodes: readonly GraphNode[]): Set<string> {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (node.selected) {
      ids.add(node.id);
    }
  }
  for (const node of nodes) {
    if (node.parentId !== undefined && ids.has(node.parentId)) {
      ids.add(node.id);
    }
  }
  return ids;
}

/** Tira os blocos e as conexões selecionados; as conexões e as exceções dos blocos removidos saem junto. */
export function deleteSelection<N extends GraphNode, E extends GraphEdge>(
  graph: Graph<N, E>,
): Graph<N, E> {
  const removed = removedNodeIds(graph.nodes);
  const edges: E[] = [];
  for (const edge of graph.edges) {
    const touchesRemoved = removed.has(edge.source) || removed.has(edge.target);
    if (!edge.selected && !touchesRemoved) {
      edges.push(edge);
    }
  }
  if (removed.size === 0 && edges.length === graph.edges.length) {
    return graph;
  }
  return {
    nodes: graph.nodes.filter((node) => !removed.has(node.id)),
    edges,
  };
}

export interface ReconnectEdgeParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly edgeId: string;
  readonly connection: ConnectionRequest;
}

/** Move as pontas da conexão se as regras deixarem; senão devolve o próprio grafo. */
export function reconnectEdge<N extends GraphNode, E extends GraphEdge>(
  params: ReconnectEdgeParams<N, E>,
): Graph<N, E> {
  const { graph, edgeId, connection } = params;
  const exists = graph.edges.some((edge) => edge.id === edgeId);
  const problem = connectionProblem({
    graph,
    connection,
    ignoreEdgeId: edgeId,
  });
  if (!exists || problem !== null) {
    return graph;
  }
  const edges: E[] = [];
  for (const edge of graph.edges) {
    if (edge.id !== edgeId) {
      edges.push(edge);
      continue;
    }
    edges.push({
      ...edge,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? null,
      targetHandle: connection.targetHandle ?? null,
    });
  }
  return { nodes: graph.nodes, edges };
}

interface WithBlockDataParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly change: (data: BlockData) => BlockData;
}

function withBlockData<N extends GraphNode, E extends GraphEdge>(
  params: WithBlockDataParams<N, E>,
): Graph<N, E> {
  const { graph, nodeId, change } = params;
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return graph;
  }
  const data = change(node.data);
  const changed = { ...node, data };
  const handles = outputHandles(changed);
  // NOTE: mudar dados pode tirar uma saída (prazo apagado, ramo removido); a conexão que saía dela vai junto.
  const kept = graph.edges.filter(
    (edge) => edge.source !== nodeId || handles.includes(sourceHandleOf(edge)),
  );
  const edges = kept.length === graph.edges.length ? graph.edges : kept;
  return {
    nodes: graph.nodes.map((candidate) =>
      candidate.id === nodeId ? changed : candidate,
    ),
    edges,
  };
}

export interface UpdateBlockDataParams<
  N extends GraphNode,
  E extends GraphEdge,
> {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly patch: Partial<BlockData>;
}

export function updateBlockData<N extends GraphNode, E extends GraphEdge>(
  params: UpdateBlockDataParams<N, E>,
): Graph<N, E> {
  const { patch } = params;
  return withBlockData({
    ...params,
    change: (data) => ({ ...data, ...patch }),
  });
}

export interface AddBranchParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly createId: () => string;
}

/** Ramo novo no fim da Decisão, com um nome provisório que nenhum outro ramo dela usa. */
export function addBranch<N extends GraphNode, E extends GraphEdge>(
  params: AddBranchParams<N, E>,
): Graph<N, E> {
  const { createId } = params;
  return withBlockData({
    ...params,
    change: (data) => {
      const branches = data.branches ?? [];
      const branch = { id: createId(), label: nextBranchLabel(branches) };
      return { ...data, branches: [...branches, branch] };
    },
  });
}

export interface RenameBranchParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly branchId: string;
  readonly label: string;
}

export function renameBranch<N extends GraphNode, E extends GraphEdge>(
  params: RenameBranchParams<N, E>,
): Graph<N, E> {
  const { branchId, label } = params;
  return withBlockData({
    ...params,
    change: (data) => {
      const branches: Branch[] = [];
      for (const branch of data.branches ?? []) {
        if (branch.id === branchId) {
          branches.push({ ...branch, label });
        } else {
          branches.push(branch);
        }
      }
      return { ...data, branches };
    },
  });
}

export interface UpdateBranchParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly branchId: string;
  readonly patch: Partial<Omit<Branch, 'id'>>;
}

/** Muda nome, condição ou descrição do ramo; o id, que também é o da saída, não muda. */
export function updateBranch<N extends GraphNode, E extends GraphEdge>(
  params: UpdateBranchParams<N, E>,
): Graph<N, E> {
  const { branchId, patch } = params;
  return withBlockData({
    ...params,
    change: (data) => {
      const branches: Branch[] = [];
      for (const branch of data.branches ?? []) {
        branches.push(
          branch.id === branchId ? { ...branch, ...patch } : branch,
        );
      }
      return { ...data, branches };
    },
  });
}

export interface SetDefaultBranchParams<
  N extends GraphNode,
  E extends GraphEdge,
> {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  /** Ramo que passa a ser o padrão; `undefined` tira o padrão. */
  readonly branchId: string | undefined;
}

/** Marca o caminho padrão e limpa a condição dele, porque o padrão é o que segue quando nenhuma condição vale. */
export function setDefaultBranch<N extends GraphNode, E extends GraphEdge>(
  params: SetDefaultBranchParams<N, E>,
): Graph<N, E> {
  const { branchId } = params;
  return withBlockData({
    ...params,
    change: (data) => {
      const branches: Branch[] = [];
      for (const branch of data.branches ?? []) {
        branches.push(
          branch.id === branchId ? { ...branch, condition: undefined } : branch,
        );
      }
      return { ...data, branches, defaultBranchId: branchId };
    },
  });
}

export interface RemoveBranchParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly branchId: string;
}

/** Tira o ramo e, com ele, a conexão que saía dele. */
export function removeBranch<N extends GraphNode, E extends GraphEdge>(
  params: RemoveBranchParams<N, E>,
): Graph<N, E> {
  const { branchId } = params;
  return withBlockData({
    ...params,
    change: (data) => {
      const branches = data.branches ?? [];
      const kept = branches.filter((branch) => branch.id !== branchId);
      return { ...data, branches: kept };
    },
  });
}

export interface UpdateEdgeLabelParams<
  N extends GraphNode,
  E extends LabeledEdge,
> {
  readonly graph: Graph<N, E>;
  readonly edgeId: string;
  readonly label: string;
}

export function updateEdgeLabel<N extends GraphNode, E extends LabeledEdge>(
  params: UpdateEdgeLabelParams<N, E>,
): Graph<N, E> {
  const { graph, edgeId, label } = params;
  if (!graph.edges.some((edge) => edge.id === edgeId)) {
    return graph;
  }
  const edges: E[] = [];
  for (const edge of graph.edges) {
    if (edge.id === edgeId) {
      edges.push({ ...edge, data: { ...edge.data, label } });
    } else {
      edges.push(edge);
    }
  }
  return { nodes: graph.nodes, edges };
}

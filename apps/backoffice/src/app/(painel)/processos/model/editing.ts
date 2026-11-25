import type {
  BlockData,
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

/** Deslocamento da cópia em relação ao original, para as duas não ficarem sobrepostas. */
export const DUPLICATE_OFFSET: Point = { x: 40, y: 40 };

/** Tira os blocos e as conexões selecionados; as conexões dos blocos removidos saem junto. */
export function deleteSelection<N extends GraphNode, E extends GraphEdge>(
  graph: Graph<N, E>,
): Graph<N, E> {
  const removed = new Set(
    graph.nodes.filter((node) => node.selected).map((node) => node.id),
  );
  const edges = graph.edges.filter(
    (edge) =>
      !edge.selected && !removed.has(edge.source) && !removed.has(edge.target),
  );
  if (removed.size === 0 && edges.length === graph.edges.length) {
    return graph;
  }
  return {
    nodes: graph.nodes.filter((node) => !removed.has(node.id)),
    edges,
  };
}

/**
 * Copia os blocos selecionados com ids novos, deslocados, e as conexões entre eles. A seleção passa para as cópias.
 * Os ids dos ramos se repetem na cópia de propósito: o id do ponto de saída só precisa ser único dentro do bloco.
 */
export function duplicateSelection<
  N extends GraphNode,
  E extends GraphEdge,
>(params: {
  readonly graph: Graph<N, E>;
  readonly createId: () => string;
}): Graph<N, E> {
  const { graph, createId } = params;
  const selected = graph.nodes.filter((node) => node.selected);
  if (selected.length === 0) {
    return graph;
  }

  const copyIds = new Map<string, string>();
  const nodeCopies: N[] = [];
  for (const node of selected) {
    const id = createId();
    copyIds.set(node.id, id);
    nodeCopies.push({
      ...node,
      id,
      selected: true,
      position: {
        x: node.position.x + DUPLICATE_OFFSET.x,
        y: node.position.y + DUPLICATE_OFFSET.y,
      },
    });
  }
  const edgeCopies: E[] = [];
  for (const edge of graph.edges) {
    const source = copyIds.get(edge.source);
    const target = copyIds.get(edge.target);
    if (source && target) {
      edgeCopies.push({ ...edge, id: createId(), source, target });
    }
  }

  const nodes = graph.nodes.map((node) =>
    node.selected ? { ...node, selected: false } : node,
  );
  const edges = graph.edges.map((edge) =>
    edge.selected ? { ...edge, selected: false } : edge,
  );
  return { nodes: [...nodes, ...nodeCopies], edges: [...edges, ...edgeCopies] };
}

/** Move as pontas da conexão se as regras deixarem; senão devolve o próprio grafo. */
export function reconnectEdge<
  N extends GraphNode,
  E extends GraphEdge,
>(params: {
  readonly graph: Graph<N, E>;
  readonly edgeId: string;
  readonly connection: ConnectionRequest;
}): Graph<N, E> {
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
  return {
    nodes: graph.nodes,
    edges: graph.edges.map((edge) =>
      edge.id === edgeId
        ? {
            ...edge,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle ?? null,
            targetHandle: connection.targetHandle ?? null,
          }
        : edge,
    ),
  };
}

function withBlockData<N extends GraphNode, E extends GraphEdge>(params: {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly change: (data: BlockData) => BlockData;
}): Graph<N, E> {
  const { graph, nodeId, change } = params;
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return graph;
  }
  const data = change(node.data);
  return {
    nodes: graph.nodes.map((candidate) =>
      candidate.id === nodeId ? { ...candidate, data } : candidate,
    ),
    edges: graph.edges,
  };
}

export function updateBlockData<
  N extends GraphNode,
  E extends GraphEdge,
>(params: {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly patch: Partial<BlockData>;
}): Graph<N, E> {
  const { patch } = params;
  return withBlockData({
    ...params,
    change: (data) => ({ ...data, ...patch }),
  });
}

/** Ramo novo no fim da Decisão, com nome provisório. */
export function addBranch<N extends GraphNode, E extends GraphEdge>(params: {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly createId: () => string;
}): Graph<N, E> {
  const { createId } = params;
  return withBlockData({
    ...params,
    change: (data) => {
      const branches = data.branches ?? [];
      const branch = {
        id: createId(),
        label: `Caminho ${branches.length + 1}`,
      };
      return { ...data, branches: [...branches, branch] };
    },
  });
}

export function renameBranch<N extends GraphNode, E extends GraphEdge>(params: {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly branchId: string;
  readonly label: string;
}): Graph<N, E> {
  const { branchId, label } = params;
  return withBlockData({
    ...params,
    change: (data) => ({
      ...data,
      branches: (data.branches ?? []).map((branch) =>
        branch.id === branchId ? { ...branch, label } : branch,
      ),
    }),
  });
}

/** Tira o ramo da Decisão e a conexão que saía dele. */
export function removeBranch<N extends GraphNode, E extends GraphEdge>(params: {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly branchId: string;
}): Graph<N, E> {
  const { nodeId, branchId } = params;
  const withoutBranch = withBlockData({
    ...params,
    change: (data) => ({
      ...data,
      branches: (data.branches ?? []).filter(
        (branch) => branch.id !== branchId,
      ),
    }),
  });
  if (withoutBranch === params.graph) {
    return withoutBranch;
  }
  return {
    nodes: withoutBranch.nodes,
    edges: withoutBranch.edges.filter(
      (edge) => !(edge.source === nodeId && sourceHandleOf(edge) === branchId),
    ),
  };
}

export function updateEdgeLabel<
  N extends GraphNode,
  E extends GraphEdge & { readonly data?: LinkData },
>(params: {
  readonly graph: Graph<N, E>;
  readonly edgeId: string;
  readonly label: string;
}): Graph<N, E> {
  const { graph, edgeId, label } = params;
  if (!graph.edges.some((edge) => edge.id === edgeId)) {
    return graph;
  }
  return {
    nodes: graph.nodes,
    edges: graph.edges.map((edge) =>
      edge.id === edgeId ? { ...edge, data: { ...edge.data, label } } : edge,
    ),
  };
}

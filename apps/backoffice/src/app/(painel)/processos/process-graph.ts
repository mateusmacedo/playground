import { type Edge, MarkerType, type Node } from '@xyflow/react';

import {
  type BlockData,
  type BlockKind,
  type Graph,
  kindOf,
  type LinkData,
  type Point,
} from './model/blocks';
import { sourceHandleOf } from './model/connections';
import type { ProcessIssue } from './model/validation';

export type ProcessNode = Node<BlockData, BlockKind>;
export type ProcessEdge = Edge<LinkData>;
export type ProcessGraph = Graph<ProcessNode, ProcessEdge>;

/** Converte o grafo serializável (vindo do servidor) nos nós e conexões que o React Flow recebe. */
export function toProcessGraph(graph: Graph): ProcessGraph {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: kindOf(node),
      position: node.position,
      data: node.data,
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    })),
  };
}

/** Tamanho aproximado de um bloco, para centralizar no ponto de inserção. */
export const BLOCK_SIZE = { width: 180, height: 64 } as const;

/** Canto superior esquerdo de um bloco centralizado em `point`. */
export function blockOrigin(point: Point): Point {
  return {
    x: point.x - BLOCK_SIZE.width / 2,
    y: point.y - BLOCK_SIZE.height / 2,
  };
}

/** Problemas agrupados pelo id do bloco ou da conexão. */
export function issuesByElement(
  issues: readonly ProcessIssue[],
): ReadonlyMap<string, readonly ProcessIssue[]> {
  const grouped = new Map<string, ProcessIssue[]>();
  for (const issue of issues) {
    const elementId = issue.nodeId ?? issue.edgeId;
    if (elementId === undefined) {
      continue;
    }
    const list = grouped.get(elementId) ?? [];
    list.push(issue);
    grouped.set(elementId, list);
  }
  return grouped;
}

export interface EdgeLabelParams {
  readonly graph: ProcessGraph;
  readonly edge: ProcessEdge;
}

/** Rótulo da conexão: o nome do ramo quando ela sai de uma Decisão, senão o rótulo próprio dela. */
export function edgeLabel(params: EdgeLabelParams): string {
  const { graph, edge } = params;
  const source = graph.nodes.find((node) => node.id === edge.source);
  const branch = source?.data.branches?.find(
    (candidate) => candidate.id === sourceHandleOf(edge),
  );
  return branch?.label ?? edge.data?.label ?? '';
}

export interface DisplayEdgesParams {
  readonly graph: ProcessGraph;
  readonly issuesById: ReadonlyMap<string, readonly ProcessIssue[]>;
}

/** Conexões como aparecem no canvas: com seta, rótulo e o destaque das que quebram as regras. */
export function displayEdges(params: DisplayEdgesParams): ProcessEdge[] {
  const { graph, issuesById } = params;
  return graph.edges.map((edge) => ({
    ...edge,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    label: edgeLabel({ graph, edge }) || undefined,
    className: issuesById.has(edge.id) ? 'process-edge--invalid' : undefined,
  }));
}

import { type Edge, MarkerType, type Node } from '@xyflow/react';

import {
  acceptsExceptions,
  type BlockData,
  type BlockKind,
  blockName,
  type Graph,
  kindOf,
  type LinkData,
  type Point,
  specOf,
} from './model/blocks';
import { sourceHandleOf } from './model/connections';
import { BLOCK_SIZE } from './model/geometry';
import type { ProcessIssue } from './model/issues';
import {
  findOutputPort,
  TRANSITION_TEXT,
  type TransitionMeaning,
} from './model/ports';

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
      ...(node.parentId === undefined ? {} : { parentId: node.parentId }),
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

/** Canto superior esquerdo de um bloco centralizado em `point`. */
export function blockOrigin(point: Point): Point {
  return {
    x: point.x - BLOCK_SIZE.width / 2,
    y: point.y - BLOCK_SIZE.height / 2,
  };
}

export interface TaskAtPointParams {
  readonly graph: ProcessGraph;
  readonly point: Point;
}

/** A tarefa (ou subprocesso) sob o ponto, que pode receber um Evento de exceção solto ali. */
export function taskAtPoint(
  params: TaskAtPointParams,
): ProcessNode | undefined {
  const { graph, point } = params;
  return graph.nodes.find((node) => {
    if (node.parentId !== undefined || !acceptsExceptions(kindOf(node))) {
      return false;
    }
    const width = node.measured?.width ?? BLOCK_SIZE.width;
    const height = node.measured?.height ?? BLOCK_SIZE.height;
    const insideX =
      point.x >= node.position.x && point.x <= node.position.x + width;
    const insideY =
      point.y >= node.position.y && point.y <= node.position.y + height;
    return insideX && insideY;
  });
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

/**
 * Rótulo da conexão: o nome da saída quando ela tem um (ramo, evento recebido, prazo expirado, exceção), senão o
 * rótulo próprio da conexão.
 */
export function edgeLabel(params: EdgeLabelParams): string {
  const { graph, edge } = params;
  const source = graph.nodes.find((node) => node.id === edge.source);
  const port = source
    ? findOutputPort({ node: source, handle: sourceHandleOf(edge) })
    : undefined;
  return port?.label ?? edge.data?.label ?? '';
}

export interface DisplayEdgesParams {
  readonly graph: ProcessGraph;
  readonly issuesById: ReadonlyMap<string, readonly ProcessIssue[]>;
}

/** Conexões como aparecem no canvas: em degraus, com seta, nome em PT-BR e o traço vermelho das que quebram as regras. */
export function displayEdges(params: DisplayEdgesParams): ProcessEdge[] {
  const { graph, issuesById } = params;
  const displays = edgeDisplays(graph);
  return graph.edges.map((edge) => {
    const display = displays.get(edge.id);
    const description = display?.description ?? 'conexão';
    const label = display?.text
      ? `${description}, ${display.text}`
      : description;
    return {
      ...edge,
      type: 'process',
      markerEnd: { type: MarkerType.ArrowClosed },
      className: issuesById.has(edge.id) ? 'process-edge--invalid' : undefined,
      ariaLabel: label.charAt(0).toUpperCase() + label.slice(1),
      domAttributes: { 'aria-roledescription': 'conexão' },
    };
  });
}

/** Blocos como aparecem no canvas: com o tipo e o nome em PT-BR para o leitor de tela. */
export function displayNodes(nodes: readonly ProcessNode[]): ProcessNode[] {
  return nodes.map((node) => {
    const kindLabel = specOf(kindOf(node)).label;
    const name = blockName(node);
    const ariaLabel = name === kindLabel ? name : `${kindLabel}: ${name}`;
    return {
      ...node,
      ariaLabel,
      domAttributes: { 'aria-roledescription': 'bloco' },
    };
  });
}

/** O que a conexão mostra: o texto do rótulo, o significado da transição e a descrição para o leitor de tela. */
export interface EdgeDisplay {
  readonly text: string;
  readonly meaning: TransitionMeaning;
  readonly meaningText: string;
  readonly description: string;
}

/** Rótulo e significado de cada conexão, pelo id. */
export function edgeDisplays(graph: ProcessGraph): Map<string, EdgeDisplay> {
  const displays = new Map<string, EdgeDisplay>();
  for (const edge of graph.edges) {
    const source = graph.nodes.find((node) => node.id === edge.source);
    const target = graph.nodes.find((node) => node.id === edge.target);
    const port = source
      ? findOutputPort({ node: source, handle: sourceHandleOf(edge) })
      : undefined;
    const meaning = port?.meaning ?? 'next';
    const from = source ? blockName(source) : 'bloco removido';
    const to = target ? blockName(target) : 'bloco removido';
    displays.set(edge.id, {
      text: edgeLabel({ graph, edge }),
      meaning,
      meaningText: TRANSITION_TEXT[meaning],
      description: `conexão de ${from} para ${to}`,
    });
  }
  return displays;
}

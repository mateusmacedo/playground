import { type Graph, kindOf } from './blocks';

/**
 * Para cada bloco, os blocos aonde o fluxo pode ir em seguida: o destino de cada conexão que sai dele e as exceções
 * presas a ele, que também desviam o fluxo da tarefa.
 */
export function nextBlocks(
  graph: Graph,
): ReadonlyMap<string, readonly string[]> {
  const next = new Map<string, string[]>();
  for (const node of graph.nodes) {
    next.set(node.id, []);
  }
  for (const edge of graph.edges) {
    next.get(edge.source)?.push(edge.target);
  }
  for (const node of graph.nodes) {
    if (node.parentId !== undefined) {
      next.get(node.parentId)?.push(node.id);
    }
  }
  return next;
}

/** O mesmo mapa no sentido contrário: de onde se chega a cada bloco. */
export function previousBlocks(
  next: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, readonly string[]> {
  const previous = new Map<string, string[]>();
  for (const id of next.keys()) {
    previous.set(id, []);
  }
  for (const [source, targets] of next) {
    for (const target of targets) {
      previous.get(target)?.push(source);
    }
  }
  return previous;
}

export interface WalkParams {
  readonly from: readonly string[];
  readonly links: ReadonlyMap<string, readonly string[]>;
  /** Bloco onde a caminhada para sem seguir adiante; ele mesmo entra no resultado. */
  readonly stopAt?: string;
}

/** Todos os blocos alcançados a partir de `from` seguindo `links`, incluindo os de partida. */
export function walk(params: WalkParams): ReadonlySet<string> {
  const { from, links, stopAt } = params;
  const visited = new Set<string>();
  const pending = [...from];
  let current = pending.pop();
  while (current !== undefined) {
    if (!visited.has(current)) {
      visited.add(current);
      if (current !== stopAt) {
        pending.push(...(links.get(current) ?? []));
      }
    }
    current = pending.pop();
  }
  return visited;
}

/** Blocos dos quais algum caminho chega a um Fim. */
export function blocksReachingEnd(graph: Graph): ReadonlySet<string> {
  const ends = graph.nodes
    .filter((node) => kindOf(node) === 'end')
    .map((node) => node.id);
  return walk({ from: ends, links: previousBlocks(nextBlocks(graph)) });
}

export interface OnCycleParams {
  readonly nodeId: string;
  readonly next: ReadonlyMap<string, readonly string[]>;
}

/** O bloco volta a ele mesmo seguindo o fluxo. */
export function isOnCycle(params: OnCycleParams): boolean {
  const { nodeId, next } = params;
  const after = walk({ from: next.get(nodeId) ?? [], links: next });
  return after.has(nodeId);
}

import {
  blockName,
  type Graph,
  type GraphEdge,
  type GraphNode,
  type InnerProcess,
  kindOf,
} from './blocks';

/** Ids dos subprocessos abertos, do nível raiz até o atual; vazio é o processo principal. */
export type ProcessPath = readonly string[];

function innerOf(graph: Graph, nodeId: string): InnerProcess | undefined {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || kindOf(node) !== 'subprocess') {
    return undefined;
  }
  return node.data.process;
}

export interface GraphAtParams {
  readonly root: Graph;
  readonly path: ProcessPath;
}

/** Grafo do nível indicado pelo caminho; `undefined` quando algum subprocesso do caminho não existe mais. */
export function graphAt(params: GraphAtParams): Graph | undefined {
  const { root, path } = params;
  let current: Graph | undefined = root;
  for (const nodeId of path) {
    if (current === undefined) {
      return undefined;
    }
    current = innerOf(current, nodeId);
  }
  return current;
}

export interface Crumb {
  readonly nodeId: string;
  readonly name: string;
}

/** Nomes dos subprocessos do caminho, para a trilha de navegação; para no primeiro que não existe. */
export function pathCrumbs(params: GraphAtParams): Crumb[] {
  const { root, path } = params;
  const crumbs: Crumb[] = [];
  let current: Graph | undefined = root;
  for (const nodeId of path) {
    const node: GraphNode | undefined = current?.nodes.find(
      (candidate) => candidate.id === nodeId,
    );
    if (!node || kindOf(node) !== 'subprocess') {
      break;
    }
    crumbs.push({ nodeId, name: blockName(node) });
    current = node.data.process;
  }
  return crumbs;
}

export interface WithInnerGraphParams<
  N extends GraphNode,
  E extends GraphEdge,
> {
  readonly root: Graph<N, E>;
  /** Caminho até o subprocesso; precisa ter ao menos um id. */
  readonly path: ProcessPath;
  readonly inner: InnerProcess;
}

/** Troca o canvas interno do subprocesso no fim do caminho; sem o caminho, devolve a própria raiz. */
export function withInnerGraph<N extends GraphNode, E extends GraphEdge>(
  params: WithInnerGraphParams<N, E>,
): Graph<N, E> {
  const { root, path, inner } = params;
  const [first, ...rest] = path;
  if (first === undefined) {
    return root;
  }
  const node = root.nodes.find((candidate) => candidate.id === first);
  const current = node?.data.process;
  if (!node || kindOf(node) !== 'subprocess' || current === undefined) {
    return root;
  }
  const process =
    rest.length === 0
      ? inner
      : withInnerGraph({ root: current, path: rest, inner });
  if (process === current) {
    return root;
  }
  const nodes = root.nodes.map((candidate) =>
    candidate.id === first
      ? { ...candidate, data: { ...candidate.data, process } }
      : candidate,
  );
  return { nodes, edges: root.edges };
}

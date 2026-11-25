import { type Graph, kindOf } from './model/blocks';
import type { Lane, ProcessDocument } from './model/document';
import {
  graphAt,
  type ProcessPath,
  pathCrumbs,
  withInnerGraph,
} from './model/subprocess';
import {
  type ProcessEdge,
  type ProcessGraph,
  type ProcessNode,
  toProcessGraph,
} from './process-graph';

/** O documento que o editor edita, salva e desfaz, com os nós e conexões no formato do React Flow. */
export type EditorDocument = ProcessDocument<ProcessNode, ProcessEdge>;

export interface CreateDocumentParams {
  readonly graph: Graph;
  readonly lanes?: readonly Lane[];
}

export function createEditorDocument(
  params: CreateDocumentParams,
): EditorDocument {
  const { graph, lanes = [] } = params;
  return { version: 1, lanes, graph: toProcessGraph(graph) };
}

/**
 * O canvas interno de um subprocesso no formato do React Flow. Mantém o que o React Flow guardou nos nós (medidas,
 * seleção), para a tela não remedir tudo a cada passo.
 */
function asProcessGraph(graph: Graph): ProcessGraph {
  return {
    nodes: graph.nodes.map((node) => ({ ...node, type: kindOf(node) })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
}

export interface LevelParams {
  readonly document: EditorDocument;
  readonly path: ProcessPath;
}

/** O caminho até o subprocesso aberto, cortado no primeiro que não existe mais (depois de desfazer, por exemplo). */
export function validPath(params: LevelParams): ProcessPath {
  const { document, path } = params;
  return pathCrumbs({ root: document.graph, path }).map(
    (crumb) => crumb.nodeId,
  );
}

/** O grafo do nível aberto; o caminho precisa ser válido. */
export function levelGraph(params: LevelParams): ProcessGraph {
  const { document, path } = params;
  if (path.length === 0) {
    return document.graph;
  }
  const inner = graphAt({ root: document.graph, path });
  return inner === undefined ? document.graph : asProcessGraph(inner);
}

export type GraphUpdate = (graph: ProcessGraph) => ProcessGraph;

export interface UpdateLevelParams extends LevelParams {
  readonly update: GraphUpdate;
}

/** Aplica a mudança no nível aberto e devolve o documento; sem mudança, devolve o mesmo documento. */
export function updateLevel(params: UpdateLevelParams): EditorDocument {
  const { document, path, update } = params;
  const current = levelGraph({ document, path });
  const next = update(current);
  if (next === current) {
    return document;
  }
  if (path.length === 0) {
    return { ...document, graph: next };
  }
  const graph = withInnerGraph({ root: document.graph, path, inner: next });
  return { ...document, graph };
}

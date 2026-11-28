import {
  type DisplayEdgesParams,
  displayEdges,
  displayNodes,
  type ProcessEdge,
  type ProcessGraph,
  type ProcessNode,
} from '../process-graph';
import { MARK_TEXT, type RunMark, TAKEN_TEXT } from './run-marks';

/** Tipo das conexões do diagrama da execução no React Flow. */
export const RUN_EDGE_TYPE = 'run';

/** O diagrama da execução não valida o desenho: nenhum bloco ou conexão aparece com problema. */
export const NO_ISSUES: DisplayEdgesParams['issuesById'] = new Map();

export interface RunNodesParams {
  readonly nodes: readonly ProcessNode[];
  readonly marks: ReadonlyMap<string, RunMark>;
}

/**
 * Blocos como aparecem no diagrama da execução: os do editor, com a moldura da marca e o estado dito no nome para o
 * leitor de tela. Bloco sem marca fica como no editor.
 */
export function runNodes(params: RunNodesParams): ProcessNode[] {
  const { nodes, marks } = params;
  return displayNodes(nodes).map((node) => {
    const mark = marks.get(node.id);
    if (mark === undefined) {
      return node;
    }
    return {
      ...node,
      className: `process-run-node process-run-node--${mark}`,
      ariaLabel: `${node.ariaLabel}, ${MARK_TEXT[mark].toLowerCase()}`,
    };
  });
}

export interface RunEdgesParams {
  readonly graph: ProcessGraph;
  readonly takenEdges: ReadonlySet<string>;
}

/**
 * Conexões como aparecem no diagrama da execução: as do editor, sem o botão de inserir, com o traço reforçado e o
 * nome dizendo quando a execução já passou por elas.
 */
export function runEdges(params: RunEdgesParams): ProcessEdge[] {
  const { graph, takenEdges } = params;
  return displayEdges({ graph, issuesById: NO_ISSUES }).map((edge) => {
    if (!takenEdges.has(edge.id)) {
      return { ...edge, type: RUN_EDGE_TYPE };
    }
    return {
      ...edge,
      type: RUN_EDGE_TYPE,
      className: 'process-run-edge--taken',
      ariaLabel: `${edge.ariaLabel}, ${TAKEN_TEXT.toLowerCase()}`,
    };
  });
}

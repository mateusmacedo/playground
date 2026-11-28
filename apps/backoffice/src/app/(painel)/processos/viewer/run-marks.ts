import type { StepState } from '@/shared/process/engine-states';
import {
  type ExitKey,
  exitKey,
  type StepRef,
  stepRefOf,
} from '@/shared/process/plan';

import {
  type Graph,
  type GraphEdge,
  type GraphNode,
  kindOf,
} from '../model/blocks';
import { sourceHandleOf } from '../model/connections';
import type { ProcessPath } from '../model/subprocess';

/** Marca de um bloco no diagrama da execução: o estado da etapa ou, no Evento de exceção, que ele foi acionado. */
export type RunMark = StepState | 'raised';

/** Nome de cada marca na tela e para o leitor de tela. */
export const MARK_TEXT: Readonly<Record<RunMark, string>> = {
  active: 'Etapa atual',
  waiting: 'Em espera',
  done: 'Concluída',
  raised: 'Exceção acionada',
};

/** Como a conexão por onde a execução já passou é chamada na tela e para o leitor de tela. */
export const TAKEN_TEXT = 'Caminho percorrido';

/** Endereço do subprocesso aberto no diagrama; `undefined` no processo principal. */
export function levelScope(path: ProcessPath): StepRef | undefined {
  let scope: StepRef | undefined;
  for (const id of path) {
    scope = stepRefOf({ scope, id });
  }
  return scope;
}

/** O que a execução diz sobre o nível mostrado no diagrama. */
export interface LevelRun {
  /** Blocos e conexões do nível mostrado. */
  readonly graph: Graph;
  /** Endereço do subprocesso que contém o nível; sem ele, o nível é o processo principal. */
  readonly scope?: StepRef;
  readonly states: ReadonlyMap<StepRef, StepState>;
  readonly takenExits: ReadonlySet<ExitKey>;
}

interface ExceptionKeyParams {
  readonly node: GraphNode;
  readonly scope?: StepRef;
}

/**
 * Chave do desvio por um Evento de exceção: o endereço da etapa a que ele está preso e o id do próprio bloco.
 * `undefined` quando o bloco está solto, porque sem etapa não há desvio.
 */
function exceptionKey(params: ExceptionKeyParams): ExitKey | undefined {
  const { node, scope } = params;
  if (node.parentId === undefined) {
    return undefined;
  }
  const stepRef = stepRefOf({ scope, id: node.parentId });
  return exitKey({ stepRef, exitId: node.id });
}

interface NodeMarkParams extends Omit<LevelRun, 'graph'> {
  readonly node: GraphNode;
}

function nodeMark(params: NodeMarkParams): RunMark | undefined {
  const { node, scope, states, takenExits } = params;
  const kind = kindOf(node);
  if (kind === 'annotation') {
    return undefined;
  }
  if (kind === 'exception') {
    const key = exceptionKey({ node, scope });
    return key !== undefined && takenExits.has(key) ? 'raised' : undefined;
  }
  return states.get(stepRefOf({ scope, id: node.id }));
}

/** Marca de cada bloco do nível, pelo id; bloco que a execução ainda não alcançou fica sem marca. */
export function nodeMarks(params: LevelRun): ReadonlyMap<string, RunMark> {
  const { graph, scope, states, takenExits } = params;
  const marks = new Map<string, RunMark>();
  for (const node of graph.nodes) {
    const mark = nodeMark({ node, scope, states, takenExits });
    if (mark !== undefined) {
      marks.set(node.id, mark);
    }
  }
  return marks;
}

interface EdgeKeyParams {
  readonly graph: Graph;
  readonly edge: GraphEdge;
  readonly scope?: StepRef;
}

/**
 * Chave da saída que a conexão representa, na convenção do motor. A conexão que sai de um Evento de exceção vale pelo
 * desvio da etapa a que ele está preso.
 */
function edgeKey(params: EdgeKeyParams): ExitKey | undefined {
  const { graph, edge, scope } = params;
  const source = graph.nodes.find((node) => node.id === edge.source);
  if (source === undefined) {
    return undefined;
  }
  if (kindOf(source) === 'exception') {
    return exceptionKey({ node: source, scope });
  }
  const stepRef = stepRefOf({ scope, id: source.id });
  return exitKey({ stepRef, exitId: sourceHandleOf(edge) });
}

/** Ids das conexões do nível por onde a execução já passou. */
export function takenEdgeIds(params: LevelRun): ReadonlySet<string> {
  const { graph, scope, takenExits } = params;
  const taken = new Set<string>();
  for (const edge of graph.edges) {
    const key = edgeKey({ graph, edge, scope });
    if (key !== undefined && takenExits.has(key)) {
      taken.add(edge.id);
    }
  }
  return taken;
}

import type { Graph, GraphEdge, GraphNode } from './blocks';
import type { IssueSeverity } from './issues';

/** Problema achado por uma regra de bloco, antes de ganhar chave e bloco. */
export interface NewIssue {
  readonly code: string;
  readonly message: string;
  readonly severity?: IssueSeverity;
  readonly branchId?: string;
}

/** O que toda regra de bloco recebe. */
export interface NodeRulesParams {
  readonly graph: Graph;
  readonly node: GraphNode;
  readonly incoming: readonly GraphEdge[];
  readonly outgoing: readonly GraphEdge[];
}

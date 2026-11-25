import {
  blockName,
  type Graph,
  type GraphEdge,
  type GraphNode,
  kindOf,
  specOf,
} from './blocks';
import {
  CONNECTION_PROBLEM_TEXT,
  connectionProblem,
  sourceHandleOf,
} from './connections';

/** Problema do processo, preso a um bloco, a uma conexão ou ao processo inteiro. */
export interface ProcessIssue {
  readonly key: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

/** Blocos alcançados a partir de algum Início, seguindo as conexões no sentido delas. */
function reachableFrom(params: {
  readonly starts: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}): ReadonlySet<string> {
  const { starts, edges } = params;
  const visited = new Set<string>();
  const pending = starts.map((node) => node.id);
  let current = pending.pop();
  while (current !== undefined) {
    if (!visited.has(current)) {
      visited.add(current);
      for (const edge of edges) {
        if (edge.source === current) {
          pending.push(edge.target);
        }
      }
    }
    current = pending.pop();
  }
  return visited;
}

function startIssues(starts: readonly GraphNode[]): ProcessIssue[] {
  if (starts.length === 0) {
    return [
      { key: 'missing-start', message: 'O processo não tem um bloco Início.' },
    ];
  }
  if (starts.length === 1) {
    return [];
  }
  return starts.map((node) => ({
    key: `multiple-starts:${node.id}`,
    nodeId: node.id,
    message: `${blockName(node)}: o processo deve ter um só Início.`,
  }));
}

function nodeIssues(params: {
  readonly node: GraphNode;
  readonly edges: readonly GraphEdge[];
  readonly reachable: ReadonlySet<string> | undefined;
}): ProcessIssue[] {
  const { node, edges, reachable } = params;
  const kind = kindOf(node);
  const spec = specOf(kind);
  const name = blockName(node);
  const incoming = edges.filter((edge) => edge.target === node.id);
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const issues: ProcessIssue[] = [];
  const add = (issue: { readonly code: string; readonly message: string }) => {
    issues.push({
      key: `${issue.code}:${node.id}`,
      nodeId: node.id,
      message: issue.message,
    });
  };

  if (spec.input !== 'none' && incoming.length === 0) {
    add({ code: 'no-input', message: `${name} não tem conexão de entrada.` });
  }
  if (kind === 'merge' && incoming.length === 1) {
    add({
      code: 'few-inputs',
      message: `${name} precisa reunir pelo menos dois caminhos.`,
    });
  }
  if (spec.output === 'single' && outgoing.length === 0) {
    add({ code: 'no-output', message: `${name} não tem conexão de saída.` });
  }
  if (kind === 'decision') {
    const branches = node.data.branches ?? [];
    if (branches.length < 2) {
      add({
        code: 'few-branches',
        message: `${name} precisa de pelo menos dois ramos.`,
      });
    }
    for (const branch of branches) {
      const linked = outgoing.some(
        (edge) => sourceHandleOf(edge) === branch.id,
      );
      if (!linked) {
        issues.push({
          key: `branch-unlinked:${node.id}:${branch.id}`,
          nodeId: node.id,
          message: `${name}: o ramo "${branch.label}" não está conectado.`,
        });
      }
    }
  }
  const unreachable =
    reachable !== undefined && kind !== 'start' && !reachable.has(node.id);
  if (unreachable && incoming.length > 0) {
    add({
      code: 'unreachable',
      message: `${name} não é alcançado a partir do Início.`,
    });
  }
  return issues;
}

function edgeIssues(graph: Graph): ProcessIssue[] {
  const issues: ProcessIssue[] = [];
  for (const edge of graph.edges) {
    const problem = connectionProblem({
      graph,
      connection: edge,
      ignoreEdgeId: edge.id,
    });
    if (problem) {
      issues.push({
        key: `invalid-edge:${edge.id}`,
        edgeId: edge.id,
        message: `Conexão inválida: ${CONNECTION_PROBLEM_TEXT[problem]}`,
      });
    }
  }
  return issues;
}

/** Tudo o que impede o processo de fazer sentido, na ordem: Início, blocos e conexões. */
export function findIssues(graph: Graph): readonly ProcessIssue[] {
  const flowNodes = graph.nodes.filter((node) => kindOf(node) !== 'annotation');
  const starts = flowNodes.filter((node) => kindOf(node) === 'start');
  // NOTE: sem Início, "inalcançável" valeria para todo bloco e só repetiria o problema principal.
  const reachable =
    starts.length > 0
      ? reachableFrom({ starts, edges: graph.edges })
      : undefined;

  const issues = startIssues(starts);
  for (const node of flowNodes) {
    issues.push(...nodeIssues({ node, edges: graph.edges, reachable }));
  }
  issues.push(...edgeIssues(graph));
  return issues;
}

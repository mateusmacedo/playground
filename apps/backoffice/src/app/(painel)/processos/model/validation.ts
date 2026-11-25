import { blockName, type Graph, type GraphNode, kindOf } from './blocks';
import { CONNECTION_PROBLEM_TEXT, connectionProblem } from './connections';
import { countIssues, type ProcessIssue } from './issues';
import {
  blocksReachingEnd,
  isOnCycle,
  nextBlocks,
  walk,
} from './validation-graph';
import { nodeIssues } from './validation-nodes';
import { pairIssues } from './validation-pairs';

function startIssues(starts: readonly GraphNode[]): ProcessIssue[] {
  if (starts.length === 0) {
    return [
      {
        key: 'missing-start',
        severity: 'error',
        message: 'O processo não tem um bloco Início.',
      },
    ];
  }
  if (starts.length === 1) {
    return [];
  }
  return starts.map((node) => ({
    key: `multiple-starts:${node.id}`,
    nodeId: node.id,
    severity: 'error',
    message: `${blockName(node)}: o processo deve ter um só Início.`,
  }));
}

interface FlowIssuesParams {
  readonly graph: Graph;
  readonly flowNodes: readonly GraphNode[];
  readonly starts: readonly GraphNode[];
}

/** Blocos fora do alcance do Início e blocos presos num ciclo que nunca chega a um Fim. */
function flowIssues(params: FlowIssuesParams): ProcessIssue[] {
  const { graph, flowNodes, starts } = params;
  // NOTE: sem Início, "inalcançável" valeria para todo bloco e só repetiria o problema principal.
  if (starts.length === 0) {
    return [];
  }
  const next = nextBlocks(graph);
  const reachable = walk({ from: starts.map((node) => node.id), links: next });
  const reachingEnd = blocksReachingEnd(graph);
  const issues: ProcessIssue[] = [];
  for (const node of flowNodes) {
    const name = blockName(node);
    const hasIncoming = graph.edges.some((edge) => edge.target === node.id);
    const attached = node.parentId !== undefined;
    if (!reachable.has(node.id) && (hasIncoming || attached)) {
      issues.push({
        key: `unreachable:${node.id}`,
        nodeId: node.id,
        severity: 'error',
        message: `${name} não é alcançado a partir do Início.`,
      });
      continue;
    }
    const trapped =
      reachable.has(node.id) &&
      !reachingEnd.has(node.id) &&
      isOnCycle({ nodeId: node.id, next });
    if (trapped) {
      issues.push({
        key: `no-exit:${node.id}`,
        nodeId: node.id,
        severity: 'error',
        message: `${name} está num ciclo sem saída para um Fim.`,
      });
    }
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
        severity: 'error',
        message: `Conexão inválida: ${CONNECTION_PROBLEM_TEXT[problem]}`,
      });
    }
  }
  return issues;
}

/** O canvas interno de cada subprocesso é validado à parte e resumido num problema do próprio bloco. */
function subprocessIssues(flowNodes: readonly GraphNode[]): ProcessIssue[] {
  const issues: ProcessIssue[] = [];
  for (const node of flowNodes) {
    if (kindOf(node) !== 'subprocess' || node.data.process === undefined) {
      continue;
    }
    const inner = findIssues(node.data.process);
    if (inner.length === 0) {
      continue;
    }
    const { errors } = countIssues(inner);
    const noun = inner.length === 1 ? 'problema' : 'problemas';
    issues.push({
      key: `inner-issues:${node.id}`,
      nodeId: node.id,
      severity: errors > 0 ? 'error' : 'warning',
      message: `${blockName(node)}: o canvas interno tem ${inner.length} ${noun}.`,
    });
  }
  return issues;
}

/** Tudo o que impede o processo de fazer sentido ou de ser operado, na ordem: Início, blocos, pares e conexões. */
export function findIssues(graph: Graph): readonly ProcessIssue[] {
  const flowNodes = graph.nodes.filter((node) => kindOf(node) !== 'annotation');
  const starts = flowNodes.filter((node) => kindOf(node) === 'start');

  const issues = startIssues(starts);
  for (const node of flowNodes) {
    const incoming = graph.edges.filter((edge) => edge.target === node.id);
    const outgoing = graph.edges.filter((edge) => edge.source === node.id);
    issues.push(...nodeIssues({ graph, node, incoming, outgoing }));
  }
  issues.push(...flowIssues({ graph, flowNodes, starts }));
  issues.push(...subprocessIssues(flowNodes));
  issues.push(...pairIssues(graph));
  issues.push(...edgeIssues(graph));
  return issues;
}

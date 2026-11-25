import {
  blockName,
  type Graph,
  type GraphNode,
  kindOf,
  PAIRED_SPLIT,
} from './blocks';
import { sourceHandleOf } from './connections';
import type { ProcessIssue } from './issues';
import { nextBlocks, walk } from './validation-graph';

interface Pair {
  readonly split: GraphNode;
  readonly join: GraphNode;
}

interface PairLookup {
  readonly pairs: Pair[];
  readonly issues: ProcessIssue[];
}

interface PairIssueParams {
  readonly join: GraphNode;
  readonly code: string;
  readonly message: string;
}

function pairIssue(params: PairIssueParams): ProcessIssue {
  const { join, code, message } = params;
  return {
    key: `${code}:${join.id}`,
    nodeId: join.id,
    severity: 'error',
    message,
  };
}

/** Liga cada sincronização e junção à abertura que ela referencia, acusando referência ausente, errada ou repetida. */
function findPairs(graph: Graph): PairLookup {
  const pairs: Pair[] = [];
  const issues: ProcessIssue[] = [];
  const claimed = new Set<string>();
  for (const join of graph.nodes) {
    const expected = PAIRED_SPLIT[kindOf(join)];
    if (expected === undefined) {
      continue;
    }
    const name = blockName(join);
    const split = graph.nodes.find((node) => node.id === join.data.pairId);
    if (join.data.pairId === undefined) {
      issues.push(
        pairIssue({
          join,
          code: 'missing-pair',
          message: `${name} não indica a abertura correspondente.`,
        }),
      );
    } else if (!split || kindOf(split) !== expected) {
      issues.push(
        pairIssue({
          join,
          code: 'invalid-pair',
          message: `${name} aponta uma abertura que não existe mais ou é de outro tipo.`,
        }),
      );
    } else if (claimed.has(split.id)) {
      issues.push(
        pairIssue({
          join,
          code: 'duplicate-pair',
          message: `${blockName(split)} já está associada a outra sincronização.`,
        }),
      );
    } else {
      claimed.add(split.id);
      pairs.push({ split, join });
    }
  }
  return { pairs, issues };
}

interface BranchCheckParams {
  readonly graph: Graph;
  readonly pair: Pair;
  readonly next: ReadonlyMap<string, readonly string[]>;
  readonly branchId: string;
}

type BranchProblem = 'loops-back' | 'ends-early' | 'misses-sync';

/** Caminha pelo ramo até a sincronização e diz o que dá errado no caminho, se algo der. */
function branchProblems(params: BranchCheckParams): BranchProblem[] {
  const { graph, pair, next, branchId } = params;
  const first = graph.edges.find(
    (edge) =>
      edge.source === pair.split.id && sourceHandleOf(edge) === branchId,
  );
  if (first === undefined) {
    // NOTE: ramo sem conexão já é apontado pelas regras do bloco; repetir aqui só dobraria o aviso.
    return [];
  }
  const visited = walk({
    from: [first.target],
    links: next,
    stopAt: pair.join.id,
  });
  const problems: BranchProblem[] = [];
  if (visited.has(pair.split.id)) {
    problems.push('loops-back');
  }
  const reachesEnd = graph.nodes.some(
    (node) => visited.has(node.id) && kindOf(node) === 'end',
  );
  if (reachesEnd) {
    problems.push('ends-early');
  }
  // NOTE: um ramo que encerra ou volta antes já explica por que não chega; "não chega" sozinho fica para o resto.
  if (problems.length === 0 && !visited.has(pair.join.id)) {
    problems.push('misses-sync');
  }
  return problems;
}

const BRANCH_PROBLEM_TEXT: Readonly<Record<BranchProblem, string>> = {
  'loops-back': 'volta à abertura antes de sincronizar',
  'ends-early': 'encerra o processo antes de',
  'misses-sync': 'não chega a',
};

/**
 * Cada ramo de uma abertura com par precisa chegar à sincronização dela sem antes encerrar o processo nem voltar à
 * abertura; senão a sincronização espera para sempre.
 */
export function pairIssues(graph: Graph): ProcessIssue[] {
  const { pairs, issues } = findPairs(graph);
  const next = nextBlocks(graph);
  for (const pair of pairs) {
    const splitName = blockName(pair.split);
    const joinName = blockName(pair.join);
    for (const branch of pair.split.data.branches ?? []) {
      const problems = branchProblems({
        graph,
        pair,
        next,
        branchId: branch.id,
      });
      for (const problem of problems) {
        const tail = problem === 'loops-back' ? '' : ` ${joinName}`;
        issues.push({
          key: `${problem}:${pair.split.id}:${branch.id}`,
          nodeId: pair.split.id,
          branchId: branch.id,
          severity: 'error',
          message: `${splitName}: o ramo "${branch.label}" ${BRANCH_PROBLEM_TEXT[problem]}${tail}.`,
        });
      }
    }
  }
  return issues;
}

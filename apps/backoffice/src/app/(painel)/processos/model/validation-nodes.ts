import {
  acceptsExceptions,
  blockName,
  type GraphNode,
  hasBranches,
  kindOf,
  specOf,
} from './blocks';
import { sourceHandleOf } from './connections';
import type { ProcessIssue } from './issues';
import { outputPorts } from './ports';
import { branchNameRules, fieldRules } from './validation-fields';
import type { NewIssue, NodeRulesParams } from './validation-rule';
import { stepFieldRules } from './validation-step-fields';

/** Tipos que reúnem caminhos e por isso precisam de pelo menos duas entradas. */
const GATHERING_KINDS = new Set(['merge', 'inclusive-join', 'parallel-join']);

function inputRules(params: NodeRulesParams): NewIssue[] {
  const issues: NewIssue[] = [];
  const { node, incoming } = params;
  const name = blockName(node);
  if (specOf(kindOf(node)).input !== 'none' && incoming.length === 0) {
    issues.push({
      code: 'no-input',
      message: `${name} não tem conexão de entrada.`,
    });
  }
  if (GATHERING_KINDS.has(kindOf(node)) && incoming.length === 1) {
    issues.push({
      code: 'few-inputs',
      message: `${name} precisa reunir pelo menos dois caminhos.`,
    });
  }
  return issues;
}

/** Toda saída do bloco precisa levar a algum lugar: a única, cada ramo e cada desfecho da espera. */
function outputRules(params: NodeRulesParams): NewIssue[] {
  const issues: NewIssue[] = [];
  const { node, outgoing } = params;
  const name = blockName(node);
  for (const port of outputPorts(node)) {
    const linked = outgoing.some((edge) => sourceHandleOf(edge) === port.id);
    if (linked) {
      continue;
    }
    if (port.meaning === 'condition' || port.meaning === 'parallel') {
      issues.push({
        code: 'branch-unlinked',
        branchId: port.id,
        message: `${name}: o ramo "${port.label}" não está conectado.`,
      });
    } else if (port.label && port.meaning !== 'exception') {
      issues.push({
        code: `port-unlinked:${port.id}`,
        message: `${name}: a saída "${port.label}" não está conectada.`,
      });
    } else {
      issues.push({
        code: 'no-output',
        message: `${name} não tem conexão de saída.`,
      });
    }
  }
  return issues;
}

function branchRules(params: NodeRulesParams): NewIssue[] {
  const issues: NewIssue[] = [];
  const { node } = params;
  if (!hasBranches(kindOf(node))) {
    return issues;
  }
  const branches = node.data.branches ?? [];
  if (branches.length < 2) {
    issues.push({
      code: 'few-branches',
      message: `${blockName(node)} precisa de pelo menos dois ramos.`,
    });
  }
  return issues;
}

function exceptionRules(params: NodeRulesParams): NewIssue[] {
  const issues: NewIssue[] = [];
  const { graph, node } = params;
  if (kindOf(node) !== 'exception') {
    return issues;
  }
  const parent = graph.nodes.find(
    (candidate) => candidate.id === node.parentId,
  );
  if (!parent || !acceptsExceptions(kindOf(parent))) {
    issues.push({
      code: 'detached-exception',
      message: `${blockName(node)} precisa estar preso a uma tarefa humana, aprovação, tarefa automatizada ou subprocesso.`,
    });
  }
  return issues;
}

function isBlank(value: string | undefined): boolean {
  return (value ?? '').trim() === '';
}

interface OperationalField {
  readonly field: string;
  readonly missing: (node: GraphNode) => boolean;
  readonly text: string;
}

/** O que cada tipo precisa ter preenchido para ser operado; falta disso é aviso, não erro de estrutura. */
const OPERATIONAL_FIELDS: Readonly<
  Record<string, readonly OperationalField[]>
> = {
  'human-task': [
    {
      field: 'role',
      missing: (node) => isBlank(node.data.role),
      text: 'não tem papel responsável',
    },
  ],
  approval: [
    {
      field: 'role',
      missing: (node) => isBlank(node.data.role),
      text: 'não tem papel aprovador',
    },
  ],
  'automated-task': [
    {
      field: 'system',
      missing: (node) => isBlank(node.data.system),
      text: 'não indica o sistema que executa a operação',
    },
  ],
  'send-message': [
    {
      field: 'recipient',
      missing: (node) => isBlank(node.data.recipient),
      text: 'não tem destinatário',
    },
    {
      field: 'channel',
      missing: (node) => node.data.channel === undefined,
      text: 'não indica o canal',
    },
  ],
  'wait-event': [
    {
      field: 'eventName',
      missing: (node) => isBlank(node.data.eventName),
      text: 'não indica o evento aguardado',
    },
  ],
  end: [
    {
      field: 'outcome',
      missing: (node) => node.data.outcome === undefined,
      text: 'não tem desfecho definido',
    },
  ],
};

function operationalRules(params: NodeRulesParams): NewIssue[] {
  const issues: NewIssue[] = [];
  const { node } = params;
  for (const entry of OPERATIONAL_FIELDS[kindOf(node)] ?? []) {
    if (entry.missing(node)) {
      issues.push({
        code: `incomplete-${entry.field}`,
        severity: 'warning',
        message: `${blockName(node)} ${entry.text}.`,
      });
    }
  }
  return issues;
}

const RULES = [
  inputRules,
  outputRules,
  branchRules,
  branchNameRules,
  exceptionRules,
  fieldRules,
  stepFieldRules,
  operationalRules,
];

/** Problemas que dependem só do bloco e das conexões dele. */
export function nodeIssues(params: NodeRulesParams): ProcessIssue[] {
  const { node } = params;
  const issues: ProcessIssue[] = [];
  for (const rule of RULES) {
    for (const found of rule(params)) {
      const suffix = found.branchId === undefined ? '' : `:${found.branchId}`;
      issues.push({
        key: `${found.code}:${node.id}${suffix}`,
        nodeId: node.id,
        message: found.message,
        severity: found.severity ?? 'error',
        ...(found.branchId === undefined ? {} : { branchId: found.branchId }),
      });
    }
  }
  return issues;
}

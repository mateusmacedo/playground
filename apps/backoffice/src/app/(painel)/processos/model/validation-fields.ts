import { blockName, type Duration, type GraphNode, kindOf } from './blocks';
import { FIELD_LABEL } from './conversion';
import { isDateTime, isDuration, isSchedule } from './fields';
import type { NewIssue, NodeRulesParams } from './validation-rule';

type DurationField = 'dueIn' | 'deadline' | 'duration' | 'timeout';

const DURATION_FIELDS: readonly DurationField[] = [
  'dueIn',
  'deadline',
  'duration',
  'timeout',
];

function isBlank(value: string | undefined): boolean {
  return (value ?? '').trim() === '';
}

function invalidDurations(node: GraphNode): NewIssue[] {
  const issues: NewIssue[] = [];
  for (const field of DURATION_FIELDS) {
    const value: Duration | undefined = node.data[field];
    if (value !== undefined && !isDuration(value)) {
      issues.push({
        code: `invalid-${field}`,
        message: `${blockName(node)}: ${FIELD_LABEL[field].toLowerCase()} inválido.`,
      });
    }
  }
  return issues;
}

/** O que cada tipo exige conforme o modo escolhido: o modo vale só com o dado que ele pede. */
function modeIssues(node: GraphNode): NewIssue[] {
  const name = blockName(node);
  const { data } = node;
  switch (kindOf(node)) {
    case 'start':
      if (data.trigger === 'schedule' && !isSchedule(data.schedule)) {
        return [
          {
            code: 'missing-schedule',
            message: `${name}: o agendamento está incompleto.`,
          },
        ];
      }
      if (data.trigger === 'message' && isBlank(data.triggerMessage)) {
        return [
          {
            code: 'missing-trigger-message',
            message: `${name}: indique a mensagem que inicia o processo.`,
          },
        ];
      }
      return [];
    case 'timer':
      if (data.timerMode === 'until') {
        return isDateTime(data.until)
          ? []
          : [
              {
                code: 'missing-until',
                message: `${name}: indique a data e o horário.`,
              },
            ];
      }
      return data.duration === undefined
        ? [
            {
              code: 'missing-duration',
              message: `${name}: indique a duração da espera.`,
            },
          ]
        : [];
    case 'exception':
      return data.exceptionTrigger === 'timeout' && data.timeout === undefined
        ? [
            {
              code: 'missing-timeout',
              message: `${name}: indique o tempo limite.`,
            },
          ]
        : [];
    case 'end':
      return data.outcome === 'other' && isBlank(data.outcomeLabel)
        ? [
            {
              code: 'missing-outcome-label',
              message: `${name}: dê um nome ao desfecho.`,
            },
          ]
        : [];
    default:
      return [];
  }
}

/** Campos com formato próprio: durações válidas e o dado que cada modo pede. */
export function fieldRules(params: NodeRulesParams): NewIssue[] {
  const { node } = params;
  return [...invalidDurations(node), ...modeIssues(node)];
}

function normalized(text: string): string {
  return text.trim().toLocaleLowerCase('pt-BR');
}

/**
 * Ramos precisam de nome, de nomes distintos (o nome vira o rótulo da conexão e o da porta) e de um caminho padrão
 * sem condição, porque ele é justamente o que segue quando nenhuma condição é atendida.
 */
export function branchNameRules(params: NodeRulesParams): NewIssue[] {
  const { node } = params;
  const name = blockName(node);
  const issues: NewIssue[] = [];
  const seen = new Set<string>();
  for (const branch of node.data.branches ?? []) {
    const key = normalized(branch.label);
    if (key === '') {
      issues.push({
        code: 'unnamed-branch',
        branchId: branch.id,
        message: `${name}: há um ramo sem nome.`,
      });
    } else if (seen.has(key)) {
      issues.push({
        code: 'duplicate-branch',
        branchId: branch.id,
        message: `${name}: há mais de um ramo chamado "${branch.label.trim()}".`,
      });
    }
    seen.add(key);
    const isDefault = branch.id === node.data.defaultBranchId;
    if (isDefault && !isBlank(branch.condition)) {
      issues.push({
        code: 'default-with-condition',
        branchId: branch.id,
        message: `${name}: o caminho padrão "${branch.label}" não pode ter condição.`,
      });
    }
  }
  return issues;
}

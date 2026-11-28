import type { StepField } from '@/shared/process/fields';

import { blockName, hasStepFields, kindOf } from './blocks';
import { nameKey } from './names';
import { stepFieldName } from './step-fields';
import type { NewIssue, NodeRulesParams } from './validation-rule';

/** O que há de errado com o nome de um campo: está em branco ou repete o de um campo anterior do bloco. */
export type FieldNameProblem = 'blank' | 'repeated';

export interface StepFieldProblems {
  readonly field: StepField;
  /** Posição do campo no bloco, a partir de 1. */
  readonly position: number;
  readonly name: FieldNameProblem | null;
  /** A lista de opções não tem nenhuma opção escrita. */
  readonly lacksOptions: boolean;
}

/** A lista de opções só serve com ao menos uma opção escrita; sem isso, o campo nunca recebe valor. */
function lacksOptions(field: StepField): boolean {
  if (field.type !== 'choice') {
    return false;
  }
  const options = field.options ?? [];
  return options.every((option) => option.trim() === '');
}

/**
 * O que falta em cada campo, na ordem da lista. É a mesma conta para a lista de problemas e para o aviso ao lado do
 * campo no painel, para os dois nunca discordarem.
 */
export function stepFieldProblems(
  fields: readonly StepField[],
): StepFieldProblems[] {
  const seen = new Set<string>();
  const problems: StepFieldProblems[] = [];
  for (const [index, field] of fields.entries()) {
    const key = nameKey(field.label);
    let name: FieldNameProblem | null = null;
    if (key === '') {
      name = 'blank';
    } else if (seen.has(key)) {
      name = 'repeated';
    }
    seen.add(key);
    problems.push({
      field,
      position: index + 1,
      name,
      lacksOptions: lacksOptions(field),
    });
  }
  return problems;
}

/**
 * Campos a preencher precisam de nome, de nomes distintos no bloco (o nome é o que a pessoa lê ao resolver a etapa e
 * o que fica no histórico) e, quando são lista, de ao menos uma opção. Tipo de bloco sem campos fica de fora.
 */
export function stepFieldRules(params: NodeRulesParams): NewIssue[] {
  const { node } = params;
  if (!hasStepFields(kindOf(node))) {
    return [];
  }
  const name = blockName(node);
  const issues: NewIssue[] = [];
  for (const problem of stepFieldProblems(node.data.fields ?? [])) {
    const { field, position } = problem;
    const fieldName = stepFieldName({ field, position });
    if (problem.name === 'blank') {
      issues.push({
        code: `unnamed-field:${field.id}`,
        message: `${name}: o campo ${position} de "Campos a preencher" está sem nome.`,
      });
    }
    if (problem.name === 'repeated') {
      issues.push({
        code: `duplicate-field:${field.id}`,
        message: `${name}: há mais de um campo chamado "${fieldName}".`,
      });
    }
    if (problem.lacksOptions) {
      issues.push({
        code: `field-without-options:${field.id}`,
        message: `${name}: a lista "${fieldName}" não tem opções.`,
      });
    }
  }
  return issues;
}

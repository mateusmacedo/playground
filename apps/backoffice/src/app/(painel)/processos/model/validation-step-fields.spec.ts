import type { StepField } from '@/shared/process/fields';

import type { Graph } from './blocks';
import { block, link } from './test-graph';
import { findIssues } from './validation';
import { stepFieldProblems } from './validation-step-fields';

const amount: StepField = {
  id: 'amount',
  label: 'Valor',
  type: 'number',
  required: true,
};

interface StepGraphParams {
  readonly type: string;
  readonly fields: readonly StepField[];
}

/** Processo mínimo e válido em que só os campos do bloco `step` podem ter problema. */
function stepGraph({ type, fields }: StepGraphParams): Graph {
  return {
    nodes: [
      block({ id: 'start', type: 'start', data: { trigger: 'manual' } }),
      block({ id: 'step', type, data: { label: 'Conferir', fields } }),
      block({ id: 'end', type: 'end', data: { outcome: 'completed' } }),
    ],
    edges: [
      link({ source: 'start', target: 'step' }),
      link({ source: 'step', target: 'end' }),
    ],
  };
}

describe('stepFieldProblems', () => {
  it('não acha problema em campo com nome próprio e lista com opção', () => {
    const origin: StepField = {
      id: 'origin',
      label: 'Origem',
      type: 'choice',
      required: false,
      options: ['', 'Loja'],
    };

    expect(stepFieldProblems([amount, origin])).toEqual([
      { field: amount, position: 1, name: null, lacksOptions: false },
      { field: origin, position: 2, name: null, lacksOptions: false },
    ]);
  });

  it('marca o nome em branco e o que repete um campo anterior', () => {
    const blank: StepField = { ...amount, id: 'blank', label: '  ' };
    const again: StepField = { ...amount, id: 'again', label: ' VALOR ' };
    const otherBlank: StepField = { ...amount, id: 'other', label: '' };

    const problems = stepFieldProblems([amount, blank, again, otherBlank]);

    expect(problems.map((problem) => problem.name)).toEqual([
      null,
      'blank',
      'repeated',
      'blank',
    ]);
  });

  it('marca a lista sem nenhuma opção escrita', () => {
    const none: StepField = { ...amount, id: 'none', type: 'choice' };
    const blanks: StepField = { ...none, id: 'blanks', options: [' ', ''] };

    const problems = stepFieldProblems([none, blanks]);

    expect(problems.map((problem) => problem.lacksOptions)).toEqual([
      true,
      true,
    ]);
  });
});

describe('findIssues nos campos a preencher', () => {
  it('não aponta nada com campos completos', () => {
    expect(findIssues(stepGraph({ type: 'task', fields: [amount] }))).toEqual(
      [],
    );
  });

  it('aponta campo sem nome, nome repetido e lista sem opções, cada um com a sua chave', () => {
    const fields: StepField[] = [
      amount,
      { id: 'blank', label: '', type: 'text', required: false },
      { id: 'again', label: 'valor', type: 'date', required: false },
      { id: 'reason', label: 'Motivo', type: 'choice', required: true },
    ];

    expect(findIssues(stepGraph({ type: 'task', fields }))).toEqual([
      {
        key: 'unnamed-field:blank:step',
        nodeId: 'step',
        severity: 'error',
        message: 'Conferir: o campo 2 de "Campos a preencher" está sem nome.',
      },
      {
        key: 'duplicate-field:again:step',
        nodeId: 'step',
        severity: 'error',
        message: 'Conferir: há mais de um campo chamado "valor".',
      },
      {
        key: 'field-without-options:reason:step',
        nodeId: 'step',
        severity: 'error',
        message: 'Conferir: a lista "Motivo" não tem opções.',
      },
    ]);
  });

  it('nomeia pela posição a lista sem nome e sem opções', () => {
    const fields: StepField[] = [
      { id: 'list', label: '', type: 'choice', required: false, options: [] },
    ];

    const messages = findIssues(stepGraph({ type: 'task', fields })).map(
      (issue) => issue.message,
    );

    expect(messages).toEqual([
      'Conferir: o campo 1 de "Campos a preencher" está sem nome.',
      'Conferir: a lista "Campo 1" não tem opções.',
    ]);
  });

  it('vale também para a Tarefa humana e a Aprovação', () => {
    const fields: StepField[] = [{ ...amount, label: '' }];
    const human = stepGraph({ type: 'human-task', fields });
    const approval: Graph = {
      nodes: [
        ...stepGraph({ type: 'approval', fields }).nodes,
        block({ id: 'refused', type: 'end', data: { outcome: 'rejected' } }),
      ],
      edges: [
        link({ source: 'start', target: 'step' }),
        link({ source: 'step', target: 'end', sourceHandle: 'approved' }),
        link({ source: 'step', target: 'refused', sourceHandle: 'rejected' }),
      ],
    };

    const humanKeys = findIssues(human).map((issue) => issue.key);
    const approvalKeys = findIssues(approval).map((issue) => issue.key);

    expect(humanKeys).toContain('unnamed-field:amount:step');
    expect(approvalKeys).toContain('unnamed-field:amount:step');
  });

  it('ignora campos que sobraram num tipo de bloco sem campos a preencher', () => {
    const fields: StepField[] = [{ ...amount, label: '' }];
    const graph = stepGraph({ type: 'automated-task', fields });

    const keys = findIssues(graph).map((issue) => issue.key);

    expect(keys.some((key) => key.startsWith('unnamed-field'))).toBe(false);
  });
});

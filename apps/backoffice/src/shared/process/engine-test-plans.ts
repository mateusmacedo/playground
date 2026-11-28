import {
  begin,
  branching,
  end,
  planOf,
  step,
  subprocess,
  tokenAt,
} from './engine-test-kit';
import type { StepField } from './fields';
import type { PlanStep, ProcessPlan } from './plan';
import type { ProcessRun } from './run';

/** Roteiro em linha: start > a > b > end. */
export const linearPlan: ProcessPlan = planOf([
  step({ id: 'start', kind: 'start', to: 'a' }),
  step({ id: 'a', to: 'b' }),
  step({ id: 'b', to: 'end' }),
  end({ id: 'end' }),
]);

/** Roteiro em paralelo: start > split > (a, b) > join > end. */
export const parallelPlan: ProcessPlan = planOf([
  step({ id: 'start', kind: 'start', to: 'split' }),
  branching({
    id: 'split',
    kind: 'parallel-split',
    branches: { left: 'a', right: 'b' },
  }),
  step({ id: 'a', to: 'join' }),
  step({ id: 'b', to: 'join' }),
  step({ id: 'join', kind: 'parallel-join', to: 'end' }),
  end({ id: 'end' }),
]);

/** Roteiro com subprocesso: start > sub[check] > end. */
export const nestedPlan: ProcessPlan = planOf([
  step({ id: 'start', kind: 'start', to: 'sub' }),
  subprocess({ id: 'sub', to: 'end', inner: [step({ id: 'check' })] }),
  end({ id: 'end' }),
]);

/** Campos de uma etapa: um texto obrigatório, um número opcional e uma caixa obrigatória. */
export const reviewFields: readonly StepField[] = [
  { id: 'opinion', label: 'Parecer', type: 'text', required: true },
  { id: 'amount', label: 'Valor', type: 'number', required: false },
  { id: 'agreed', label: 'De acordo', type: 'checkbox', required: true },
];

/** Roteiro start > etapa em teste, com as tarefas `done` e `other` para onde ela pode seguir, e o Fim `end`. */
export function planAround(subject: PlanStep): ProcessPlan {
  return planOf([
    step({ id: 'start', kind: 'start', to: subject.id }),
    subject,
    step({ id: 'done', to: 'end' }),
    step({ id: 'other', to: 'end' }),
    end({ id: 'end' }),
  ]);
}

export interface StoppedRun {
  readonly plan: ProcessPlan;
  readonly run: ProcessRun;
  /** Id da ficha parada na etapa em teste. */
  readonly tokenId: string;
}

/** Execução do roteiro em volta da etapa, parada nela. */
export function stoppedAt(subject: PlanStep): StoppedRun {
  const plan = planAround(subject);
  const run = begin(plan);
  return { plan, run, tokenId: tokenAt({ run, stepRef: subject.id }).id };
}

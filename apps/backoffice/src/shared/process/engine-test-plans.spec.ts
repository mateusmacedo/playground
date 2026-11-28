import { begin, step, tokenRefs } from './engine-test-kit';
import {
  linearPlan,
  nestedPlan,
  parallelPlan,
  planAround,
  reviewFields,
  stoppedAt,
} from './engine-test-plans';

describe('roteiros de teste prontos', () => {
  it('o roteiro em linha para na primeira tarefa', () => {
    expect(tokenRefs(begin(linearPlan))).toEqual(['a']);
  });

  it('o roteiro em paralelo abre os dois caminhos', () => {
    expect(tokenRefs(begin(parallelPlan))).toEqual(['a', 'b']);
  });

  it('o roteiro com subprocesso entra no processo interno', () => {
    expect(tokenRefs(begin(nestedPlan))).toEqual(['sub', 'sub/check']);
  });

  it('os campos de teste têm dois obrigatórios e um opcional', () => {
    const required = reviewFields.filter((field) => field.required);

    expect(required.map((field) => field.id)).toEqual(['opinion', 'agreed']);
    expect(reviewFields).toHaveLength(3);
  });
});

describe('planAround e stoppedAt', () => {
  const subject = step({ id: 'a', kind: 'human-task', to: 'done' });

  it('planAround põe a etapa em teste logo depois do Início', () => {
    const plan = planAround(subject);

    expect(plan.startId).toBe('start');
    expect(plan.steps.map((item) => item.id)).toEqual([
      'start',
      'a',
      'done',
      'other',
      'end',
    ]);
    expect(plan.steps[1]).toBe(subject);
  });

  it('stoppedAt devolve a execução parada na etapa, com a ficha dela', () => {
    const { plan, run, tokenId } = stoppedAt(subject);

    expect(plan).toEqual(planAround(subject));
    expect(run.tokens).toEqual([
      { id: tokenId, stepRef: 'a', since: run.startedAt },
    ]);
  });
});

import { joinToFire } from './engine-joins';
import {
  ACTED_AT,
  begin,
  branching,
  end,
  planOf,
  resolve,
  STARTED_AT,
  step,
} from './engine-test-kit';
import type { ProcessPlan, StepKind } from './plan';
import type { ProcessRun, RunToken } from './run';

interface ForkParams {
  readonly split: StepKind;
  readonly join: StepKind;
}

/** Roteiro start > abertura > (a, b, c) > junção > after > end. */
function forkOf(params: ForkParams): ProcessPlan {
  return planOf([
    step({ id: 'start', kind: 'start', to: 'split' }),
    branching({
      id: 'split',
      kind: params.split,
      branches: { one: 'a', two: 'b', three: 'c' },
    }),
    step({ id: 'a', to: 'join' }),
    step({ id: 'b', to: 'join' }),
    step({ id: 'c', to: 'join' }),
    step({ id: 'join', kind: params.join, to: 'after' }),
    step({ id: 'after', to: 'end' }),
    end({ id: 'end' }),
  ]);
}

type TokenSeed = Pick<RunToken, 'stepRef' | 'waiting'>;

function waiting(stepRef: string): TokenSeed {
  return { stepRef, waiting: true };
}

function pending(stepRef: string): TokenSeed {
  return { stepRef };
}

/** Fichas `token-1`, `token-2` e assim por diante, na ordem dada, que é a ordem em que elas pararam. */
function tokensOf(seeds: readonly TokenSeed[]): readonly RunToken[] {
  return seeds.map((seed, index) => ({
    id: `token-${index + 1}`,
    since: STARTED_AT,
    ...seed,
  }));
}

describe('joinToFire', () => {
  const plan = forkOf({ split: 'parallel-split', join: 'parallel-join' });

  it('não acha junção quando nenhuma ficha está em espera', () => {
    const tokens = tokensOf([pending('a'), pending('b')]);

    expect(joinToFire({ plan, tokens })).toBeUndefined();
  });

  it('acha a junção que nenhuma outra ficha alcança', () => {
    const tokens = tokensOf([waiting('join'), pending('after')]);

    expect(joinToFire({ plan, tokens })?.stepRef).toBe('join');
  });

  it('não acha junção enquanto uma ficha pendente a alcança', () => {
    const tokens = tokensOf([waiting('join'), pending('c')]);

    expect(joinToFire({ plan, tokens })).toBeUndefined();
  });

  it('ignora a ficha em espera fora do roteiro e a ficha de outro nível', () => {
    const tokens = tokensOf([
      waiting('ghost'),
      waiting('lost/join'),
      waiting('join'),
      pending('sub/c'),
      pending('ghost'),
    ]);

    expect(joinToFire({ plan, tokens })?.stepRef).toBe('join');
  });

  describe('com junções que esperam umas pelas outras', () => {
    // Ciclo first > x > second > y > first: cada junção alcança a outra.
    const cyclic = planOf([
      step({ id: 'start', kind: 'start', to: 'first' }),
      step({ id: 'first', kind: 'parallel-join', to: 'x' }),
      step({ id: 'x', to: 'second' }),
      step({ id: 'second', kind: 'inclusive-join', to: 'y' }),
      step({ id: 'y', to: 'first' }),
      step({ id: 'aside' }),
    ]);

    it('dispara a de espera mais antiga para desfazer o impasse', () => {
      const tokens = tokensOf([waiting('second'), waiting('first')]);

      expect(joinToFire({ plan: cyclic, tokens })?.stepRef).toBe('second');
    });

    it('desfaz o impasse mesmo com outra ficha pendente que não alcança as junções', () => {
      const tokens = tokensOf([
        waiting('first'),
        waiting('second'),
        pending('aside'),
      ]);

      expect(joinToFire({ plan: cyclic, tokens })?.stepRef).toBe('first');
    });

    it('não dispara enquanto uma ficha pendente ainda alcança as junções', () => {
      const tokens = tokensOf([
        waiting('first'),
        waiting('second'),
        pending('x'),
      ]);

      expect(joinToFire({ plan: cyclic, tokens })).toBeUndefined();
    });

    it('a execução sai do impasse no avanço seguinte e volta a esperar pela regra', () => {
      const tokens = tokensOf([
        waiting('first'),
        waiting('second'),
        pending('aside'),
      ]);
      const run: ProcessRun = { ...begin(cyclic), tokens, nextToken: 4 };

      const moved = resolve({ plan: cyclic, run, stepRef: 'aside' });

      expect(moved.tokens).toEqual([
        { id: 'token-2', stepRef: 'second', since: STARTED_AT, waiting: true },
        { id: 'token-4', stepRef: 'x', since: ACTED_AT },
      ]);
    });
  });
});

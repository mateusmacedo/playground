import {
  ACTED_AT,
  act,
  begin,
  branching,
  end,
  exception,
  planOf,
  resolve,
  step,
  subprocess,
  tokenAt,
  tokenRefs,
} from './engine-test-kit';
import type { ProcessPlan, StepKind } from './plan';

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

describe('sincronização paralela', () => {
  const plan = forkOf({ split: 'parallel-split', join: 'parallel-join' });

  it('a ficha que chega fica em espera enquanto outro caminho ainda alcança a junção', () => {
    const first = resolve({ plan, run: begin(plan), stepRef: 'a' });
    const second = resolve({ plan, run: first, stepRef: 'b' });

    expect(first.tokens.at(-1)).toEqual({
      id: 'token-4',
      stepRef: 'join',
      since: ACTED_AT,
      waiting: true,
    });
    expect(tokenRefs(second)).toEqual(['c', 'join', 'join']);
    expect(second.takenExits).not.toContain('join:out');
  });

  it('dispara quando o último caminho chega: as fichas em espera viram uma só', () => {
    const first = resolve({ plan, run: begin(plan), stepRef: 'a' });
    const second = resolve({ plan, run: first, stepRef: 'b' });
    const at = '2026-11-26T16:00:00.000Z';

    const fired = resolve({ plan, run: second, stepRef: 'c', at });

    expect(fired.tokens).toEqual([
      { id: 'token-7', stepRef: 'after', since: at },
    ]);
    expect(fired.takenExits).toContain('join:out');
  });
});

describe('junção inclusiva', () => {
  const plan = forkOf({ split: 'inclusive-split', join: 'inclusive-join' });

  it('espera só os caminhos que a decisão inclusiva ativou', () => {
    const chosen = resolve({
      plan,
      run: begin(plan),
      stepRef: 'split',
      exitIds: ['one', 'three'],
    });
    const first = resolve({ plan, run: chosen, stepRef: 'a' });

    const fired = resolve({ plan, run: first, stepRef: 'c' });

    expect(tokenRefs(first)).toEqual(['c', 'join']);
    expect(tokenRefs(fired)).toEqual(['after']);
  });

  it('dispara na hora quando só um caminho foi ativado', () => {
    const chosen = resolve({
      plan,
      run: begin(plan),
      stepRef: 'split',
      exitIds: ['two'],
    });

    const fired = resolve({ plan, run: chosen, stepRef: 'b' });

    expect(tokenRefs(fired)).toEqual(['after']);
  });
});

describe('regra de alcance das junções', () => {
  it('não espera o caminho que não leva à junção', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'split' }),
      branching({
        id: 'split',
        kind: 'parallel-split',
        branches: { left: 'a', right: 'b' },
      }),
      step({ id: 'a', to: 'join' }),
      step({ id: 'b', to: 'end' }),
      step({ id: 'join', kind: 'parallel-join', to: 'after' }),
      step({ id: 'after', to: 'end' }),
      end({ id: 'end' }),
    ]);

    const fired = resolve({ plan, run: begin(plan), stepRef: 'a' });

    expect(tokenRefs(fired)).toEqual(['b', 'after']);
  });

  it('espera a decisão que ainda pode levar à junção e dispara quando ela vai para outro lado', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'split' }),
      branching({
        id: 'split',
        kind: 'parallel-split',
        branches: { left: 'a', right: 'pick' },
      }),
      step({ id: 'a', to: 'join' }),
      branching({
        id: 'pick',
        kind: 'decision',
        branches: { yes: 'join', no: 'end' },
      }),
      step({ id: 'join', kind: 'parallel-join', to: 'after' }),
      step({ id: 'after', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const held = resolve({ plan, run: begin(plan), stepRef: 'a' });

    const fired = resolve({
      plan,
      run: held,
      stepRef: 'pick',
      exitIds: ['no'],
    });

    expect(tokenRefs(held)).toEqual(['pick', 'join']);
    expect(tokenRefs(fired)).toEqual(['after']);
  });

  it('conta a saída de exceção no alcance', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'split' }),
      branching({
        id: 'split',
        kind: 'parallel-split',
        branches: { left: 'a', right: 'b' },
      }),
      step({ id: 'a', to: 'join' }),
      step({
        id: 'b',
        to: 'end',
        data: { events: [exception({ id: 'boom', to: 'join' })] },
      }),
      step({ id: 'join', kind: 'parallel-join', to: 'after' }),
      step({ id: 'after', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const held = resolve({ plan, run: begin(plan), stepRef: 'a' });
    const tokenId = tokenAt({ run: held, stepRef: 'b' }).id;

    const fired = act({
      plan,
      run: held,
      action: { kind: 'raise', tokenId, eventId: 'boom' },
    });

    expect(tokenRefs(held)).toEqual(['b', 'join']);
    expect(tokenRefs(fired)).toEqual(['after']);
  });

  it('a ficha dentro de um subprocesso conta como estando no bloco dele', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'split' }),
      branching({
        id: 'split',
        kind: 'parallel-split',
        branches: { left: 'a', right: 'sub' },
      }),
      step({ id: 'a', to: 'join' }),
      subprocess({ id: 'sub', to: 'join', inner: [step({ id: 'check' })] }),
      step({ id: 'join', kind: 'parallel-join', to: 'after' }),
      step({ id: 'after', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const held = resolve({ plan, run: begin(plan), stepRef: 'a' });

    const fired = resolve({ plan, run: held, stepRef: 'sub/check' });

    expect(tokenRefs(held)).toEqual(['sub', 'sub/check', 'join']);
    expect(tokenRefs(fired)).toEqual(['after']);
  });

  it('a junção de dentro do subprocesso só olha as fichas do nível dela', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'split' }),
      branching({
        id: 'split',
        kind: 'parallel-split',
        branches: { left: 'join', right: 'sub' },
      }),
      step({ id: 'join', to: 'end' }),
      subprocess({
        id: 'sub',
        to: 'end',
        inner: [
          step({ id: 'check', to: 'join' }),
          step({ id: 'join', kind: 'parallel-join', to: 'last' }),
          step({ id: 'last' }),
        ],
      }),
      end({ id: 'end' }),
    ]);

    const fired = resolve({ plan, run: begin(plan), stepRef: 'sub/check' });

    expect(tokenRefs(fired)).toEqual(['join', 'sub', 'sub/last']);
  });

  it('a junção encadeada espera a anterior e recebe a ficha dela antes de disparar', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'split' }),
      branching({
        id: 'split',
        kind: 'parallel-split',
        branches: { one: 'a', two: 'b', three: 'c' },
      }),
      step({ id: 'a', to: 'second' }),
      step({ id: 'b', to: 'first' }),
      step({ id: 'c', to: 'first' }),
      step({ id: 'first', kind: 'parallel-join', to: 'second' }),
      step({ id: 'second', kind: 'parallel-join', to: 'after' }),
      step({ id: 'after', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const early = resolve({ plan, run: begin(plan), stepRef: 'a' });
    const held = resolve({ plan, run: early, stepRef: 'b' });

    const fired = resolve({ plan, run: held, stepRef: 'c' });

    expect(tokenRefs(held)).toEqual(['c', 'second', 'first']);
    expect(tokenRefs(fired)).toEqual(['after']);
    expect(fired.tokens).toHaveLength(1);
  });
});

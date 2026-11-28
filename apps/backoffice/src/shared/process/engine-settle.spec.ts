import { advance, startRun } from './engine';
import { AUTOMATIC_STEP_LIMIT } from './engine-settle';
import {
  ACTED_AT,
  begin,
  branching,
  end,
  planOf,
  resolve,
  STARTED_AT,
  step,
  tokenAt,
  tokenRefs,
} from './engine-test-kit';
import type { PlanStep, ProcessPlan } from './plan';

/** Roteiro start > `count` convergências em fila > work > end. */
function chainOf(count: number): ProcessPlan {
  const merges: PlanStep[] = [];
  for (let index = 0; index < count; index += 1) {
    const to = index + 1 < count ? `merge-${index + 1}` : 'work';
    merges.push(step({ id: `merge-${index}`, kind: 'merge', to }));
  }
  return planOf([
    step({ id: 'start', kind: 'start', to: 'merge-0' }),
    ...merges,
    step({ id: 'work', to: 'end' }),
    end({ id: 'end' }),
  ]);
}

describe('travessia das etapas automáticas', () => {
  it('atravessa o Início e a convergência sem esperar ação', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'merge' }),
      step({ id: 'merge', kind: 'merge', to: 'work' }),
      step({ id: 'work', to: 'end' }),
      end({ id: 'end' }),
    ]);

    const run = begin(plan);

    expect(tokenRefs(run)).toEqual(['work']);
    expect(run.takenExits).toEqual(['start:out', 'merge:out']);
  });

  it('na convergência, cada ficha que chega segue sozinha', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'split' }),
      branching({
        id: 'split',
        kind: 'parallel-split',
        branches: { left: 'a', right: 'b' },
      }),
      step({ id: 'a', to: 'merge' }),
      step({ id: 'b', to: 'merge' }),
      step({ id: 'merge', kind: 'merge', to: 'work' }),
      step({ id: 'work', to: 'end' }),
      end({ id: 'end' }),
    ]);

    const first = resolve({ plan, run: begin(plan), stepRef: 'a' });
    const second = resolve({ plan, run: first, stepRef: 'b' });

    expect(tokenRefs(first)).toEqual(['b', 'work']);
    expect(tokenRefs(second)).toEqual(['work', 'work']);
  });

  it('a abertura paralela cria uma ficha por saída, na ordem do roteiro', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'split' }),
      branching({
        id: 'split',
        kind: 'parallel-split',
        branches: { one: 'a', two: 'b', three: 'c' },
      }),
      step({ id: 'a' }),
      step({ id: 'b' }),
      step({ id: 'c' }),
    ]);

    const run = begin(plan);

    expect(run.tokens).toEqual([
      { id: 'token-1', stepRef: 'a', since: STARTED_AT },
      { id: 'token-2', stepRef: 'b', since: STARTED_AT },
      { id: 'token-3', stepRef: 'c', since: STARTED_AT },
    ]);
    expect(run.takenExits).toEqual([
      'start:out',
      'split:one',
      'split:two',
      'split:three',
    ]);
  });

  it('não repete a saída percorrida quando um laço passa por ela de novo', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'merge' }),
      step({ id: 'merge', kind: 'merge', to: 'work' }),
      step({ id: 'work', to: 'merge' }),
    ]);

    const again = resolve({ plan, run: begin(plan), stepRef: 'work' });

    expect(tokenRefs(again)).toEqual(['work']);
    expect(again.takenExits).toEqual(['start:out', 'merge:out', 'work:out']);
  });
});

describe('proteção contra laço sem fim', () => {
  it('aceita a travessia que cabe no limite de passos automáticos', () => {
    // NOTE: o Início, as convergências e a parada na tarefa somam exatamente o limite.
    const plan = chainOf(AUTOMATIC_STEP_LIMIT - 2);

    const run = begin(plan);

    expect(tokenRefs(run)).toEqual(['work']);
  });

  it('recusa a travessia que passa do limite de passos automáticos', () => {
    const plan = chainOf(AUTOMATIC_STEP_LIMIT - 1);

    const result = startRun({
      definitionId: 'process-1',
      version: 1,
      name: 'Processo',
      plan,
      at: STARTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'endless-loop' } });
  });

  it('recusa a ação que leva a um laço só de automáticos', () => {
    const plan = planOf([
      step({ id: 'work', to: 'first' }),
      step({ id: 'first', kind: 'merge', to: 'second' }),
      step({ id: 'second', kind: 'merge', to: 'first' }),
    ]);
    const run = begin(plan);
    const tokenId = tokenAt({ run, stepRef: 'work' }).id;

    const result = advance({
      plan,
      run,
      action: { kind: 'complete', tokenId },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'endless-loop',
        message:
          'O processo entrou num laço sem nenhuma etapa que espere uma ação.',
      },
    });
  });

  it('corta o laço da junção que volta a si mesma', () => {
    const plan = planOf([
      step({ id: 'work', to: 'join' }),
      step({ id: 'join', kind: 'parallel-join', to: 'join' }),
    ]);
    const run = begin(plan);
    const tokenId = tokenAt({ run, stepRef: 'work' }).id;

    const result = advance({
      plan,
      run,
      action: { kind: 'complete', tokenId },
      at: ACTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'endless-loop' } });
  });
});

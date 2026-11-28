import { resolvedRefs, stepStates } from './engine-states';
import {
  act,
  begin,
  branching,
  end,
  exception,
  planOf,
  resolve,
  STARTED_AT,
  step,
  subprocess,
  tokenAt,
} from './engine-test-kit';
import type { ProcessRun } from './run';

// start > split > (a > join, b > join) > join > sub[check > close] > end; a tem as exceções boom e warn.
const plan = planOf([
  step({ id: 'start', kind: 'start', to: 'split' }),
  branching({
    id: 'split',
    kind: 'parallel-split',
    branches: { left: 'a', right: 'b' },
  }),
  step({
    id: 'a',
    to: 'join',
    data: {
      events: [
        exception({ id: 'boom', to: 'fix' }),
        exception({ id: 'warn', to: 'fix', interrupting: false }),
      ],
    },
  }),
  step({ id: 'b', to: 'join' }),
  step({ id: 'fix', to: 'aborted' }),
  step({ id: 'join', kind: 'parallel-join', to: 'sub' }),
  subprocess({
    id: 'sub',
    to: 'end',
    inner: [step({ id: 'check', to: 'close' }), end({ id: 'close' })],
  }),
  end({ id: 'end' }),
  end({ id: 'aborted' }),
]);

function statesOf(run: ProcessRun): Record<string, string> {
  return Object.fromEntries(stepStates({ plan, run }).states);
}

describe('stepStates', () => {
  it('marca as etapas atravessadas como concluídas e as das fichas como ativas', () => {
    const run = begin(plan);

    expect(statesOf(run)).toEqual({
      start: 'done',
      split: 'done',
      a: 'active',
      b: 'active',
    });
  });

  it('devolve as saídas percorridas como conjunto', () => {
    const { takenExits } = stepStates({ plan, run: begin(plan) });

    expect([...takenExits]).toEqual(['start:out', 'split:left', 'split:right']);
    expect(takenExits.has('split:left')).toBe(true);
  });

  it('marca a junção com ficha em espera', () => {
    const run = resolve({ plan, run: begin(plan), stepRef: 'a' });

    expect(statesOf(run)).toMatchObject({
      a: 'done',
      b: 'active',
      join: 'waiting',
    });
  });

  it('marca o subprocesso em andamento como ativo, com as etapas internas pelo endereço', () => {
    const first = resolve({ plan, run: begin(plan), stepRef: 'a' });
    const run = resolve({ plan, run: first, stepRef: 'b' });

    expect(statesOf(run)).toEqual({
      start: 'done',
      split: 'done',
      a: 'done',
      b: 'done',
      join: 'done',
      sub: 'active',
      'sub/check': 'active',
    });
  });

  it('marca o Fim alcançado e o subprocesso de onde a execução saiu', () => {
    const first = resolve({ plan, run: begin(plan), stepRef: 'a' });
    const second = resolve({ plan, run: first, stepRef: 'b' });
    const run = resolve({ plan, run: second, stepRef: 'sub/check' });

    expect(run.status).toBe('completed');
    expect(statesOf(run)).toMatchObject({
      sub: 'done',
      'sub/check': 'done',
      'sub/close': 'done',
      end: 'done',
    });
    expect(statesOf(run).aborted).toBeUndefined();
  });

  it('a etapa interrompida por uma exceção conta como concluída', () => {
    const started = begin(plan);
    const tokenId = tokenAt({ run: started, stepRef: 'a' }).id;

    const run = act({
      plan,
      run: started,
      action: { kind: 'raise', tokenId, eventId: 'boom' },
    });

    expect(statesOf(run)).toMatchObject({ a: 'done', fix: 'active' });
    expect(run.takenExits).toContain('a:boom');
  });

  it('a etapa que continua depois de uma exceção que não interrompe segue ativa', () => {
    const started = begin(plan);
    const tokenId = tokenAt({ run: started, stepRef: 'a' }).id;

    const run = act({
      plan,
      run: started,
      action: { kind: 'raise', tokenId, eventId: 'warn' },
    });

    expect(statesOf(run)).toMatchObject({ a: 'active', fix: 'active' });
  });

  it('a etapa já resolvida a que um laço voltou aparece como ativa', () => {
    const loop = planOf([
      step({ id: 'merge', kind: 'merge', to: 'work' }),
      step({ id: 'work', to: 'merge' }),
    ]);

    const run = resolve({ plan: loop, run: begin(loop), stepRef: 'work' });

    expect(Object.fromEntries(stepStates({ plan: loop, run }).states)).toEqual({
      merge: 'done',
      work: 'active',
    });
  });

  it('a execução cancelada mostra só por onde passou', () => {
    const run = act({ plan, run: begin(plan), action: { kind: 'cancel' } });

    expect(statesOf(run)).toEqual({ start: 'done', split: 'done' });
  });
});

describe('resolvedRefs', () => {
  it('não conta a etapa de onde a execução só saiu por exceção que não interrompe', () => {
    const run: ProcessRun = {
      ...begin(plan),
      tokens: [],
      takenExits: ['a:warn'],
    };

    expect([...resolvedRefs({ plan, run })]).toEqual([]);
  });

  it('conta a etapa sem saída quando um caminho chegou a ela e não há ficha ali', () => {
    const bare = planOf([
      step({ id: 'start', kind: 'start', to: 'last' }),
      step({ id: 'last', data: { exits: [] } }),
    ]);
    const waiting = begin(bare);
    const done = resolve({ plan: bare, run: waiting, stepRef: 'last' });

    expect([...resolvedRefs({ plan: bare, run: waiting })]).toEqual(['start']);
    expect([...resolvedRefs({ plan: bare, run: done })]).toEqual([
      'start',
      'last',
    ]);
  });

  it('conta a etapa de início sem saída depois que a ficha sai dela', () => {
    const only = planOf([step({ id: 'only', data: { exits: [] } })]);
    const waiting = begin(only);
    const done = resolve({ plan: only, run: waiting, stepRef: 'only' });

    expect([...resolvedRefs({ plan: only, run: waiting })]).toEqual([]);
    expect([...resolvedRefs({ plan: only, run: done })]).toEqual(['only']);
  });

  it('conta o início sem saída do processo interno só depois de entrar no subprocesso', () => {
    const deep = planOf([
      step({ id: 'a', to: 'outer' }),
      subprocess({
        id: 'outer',
        to: 'after',
        inner: [subprocess({ id: 'inner', inner: [end({ id: 'close' })] })],
      }),
      step({ id: 'after' }),
    ]);
    const before = begin(deep);
    const entered = resolve({ plan: deep, run: before, stepRef: 'a' });

    expect([...resolvedRefs({ plan: deep, run: before })]).toEqual([]);
    expect([...resolvedRefs({ plan: deep, run: entered })]).toEqual([
      'a',
      'outer',
      'outer/inner',
      'outer/inner/close',
    ]);
  });

  it('ignora a saída percorrida que não é de nenhuma etapa do roteiro', () => {
    const run: ProcessRun = {
      ...begin(plan),
      tokens: [{ id: 'token-9', stepRef: 'ghost', since: STARTED_AT }],
      takenExits: ['ghost:out', 'start:other'],
    };

    expect([...resolvedRefs({ plan, run })]).toEqual([]);
  });
});

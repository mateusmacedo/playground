import { runProgress } from './engine-progress';
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

// start > a > b > end.
const linear = planOf([
  step({ id: 'start', kind: 'start', to: 'a' }),
  step({ id: 'a', to: 'b' }),
  step({ id: 'b', to: 'end' }),
  end({ id: 'end' }),
]);

describe('runProgress', () => {
  it('no início, nada foi feito e restam as etapas acionáveis à frente', () => {
    const run = begin(linear);

    expect(runProgress({ plan: linear, run })).toEqual({
      done: 0,
      remaining: 2,
      total: 2,
    });
  });

  it('a cada etapa resolvida, uma passa de restante para feita', () => {
    const run = resolve({ plan: linear, run: begin(linear), stepRef: 'a' });

    expect(runProgress({ plan: linear, run })).toEqual({
      done: 1,
      remaining: 1,
      total: 2,
    });
  });

  it('a execução concluída não tem etapa restante', () => {
    const first = resolve({ plan: linear, run: begin(linear), stepRef: 'a' });
    const run = resolve({ plan: linear, run: first, stepRef: 'b' });

    expect(runProgress({ plan: linear, run })).toEqual({
      done: 2,
      remaining: 0,
      total: 2,
    });
  });

  it('a execução cancelada não tem etapa restante', () => {
    const first = resolve({ plan: linear, run: begin(linear), stepRef: 'a' });
    const run = act({ plan: linear, run: first, action: { kind: 'cancel' } });

    expect(runProgress({ plan: linear, run })).toEqual({
      done: 1,
      remaining: 0,
      total: 1,
    });
  });

  it('a execução encerrada não tem etapa restante mesmo que guarde fichas', () => {
    const run: ProcessRun = { ...begin(linear), status: 'cancelled' };

    expect(runProgress({ plan: linear, run })).toEqual({
      done: 0,
      remaining: 0,
      total: 0,
    });
  });

  it('não conta as etapas que o motor atravessa sozinho', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'split' }),
      branching({
        id: 'split',
        kind: 'parallel-split',
        branches: { left: 'a', right: 'b' },
      }),
      step({ id: 'a', to: 'join' }),
      step({ id: 'b', to: 'join' }),
      step({ id: 'join', kind: 'parallel-join', to: 'merge' }),
      step({ id: 'merge', kind: 'merge', to: 'c' }),
      step({ id: 'c', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const started = begin(plan);
    const waiting = resolve({ plan, run: started, stepRef: 'a' });

    expect(runProgress({ plan, run: started })).toEqual({
      done: 0,
      remaining: 3,
      total: 3,
    });
    expect(runProgress({ plan, run: waiting })).toEqual({
      done: 1,
      remaining: 2,
      total: 3,
    });
  });

  it('conta só os ramos que as fichas ainda alcançam', () => {
    const plan = planOf([
      branching({
        id: 'pick',
        kind: 'decision',
        branches: { short: 'a', long: 'b' },
      }),
      step({ id: 'a', to: 'end' }),
      step({ id: 'b', to: 'c' }),
      step({ id: 'c', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const started = begin(plan);
    const short = resolve({
      plan,
      run: started,
      stepRef: 'pick',
      exitIds: ['short'],
    });

    expect(runProgress({ plan, run: started })).toEqual({
      done: 0,
      remaining: 4,
      total: 4,
    });
    expect(runProgress({ plan, run: short })).toEqual({
      done: 1,
      remaining: 1,
      total: 2,
    });
  });

  it('conta o caminho da exceção como alcançável e a etapa interrompida como feita', () => {
    const plan = planOf([
      step({
        id: 'a',
        to: 'end',
        data: { events: [exception({ id: 'boom', to: 'fix' })] },
      }),
      step({ id: 'fix', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const started = begin(plan);
    const tokenId = tokenAt({ run: started, stepRef: 'a' }).id;
    const failed = act({
      plan,
      run: started,
      action: { kind: 'raise', tokenId, eventId: 'boom' },
    });

    expect(runProgress({ plan, run: started })).toEqual({
      done: 0,
      remaining: 2,
      total: 2,
    });
    expect(runProgress({ plan, run: failed })).toEqual({
      done: 1,
      remaining: 1,
      total: 2,
    });
  });

  describe('com subprocesso', () => {
    const plan = planOf([
      step({ id: 'a', to: 'sub' }),
      subprocess({
        id: 'sub',
        to: 'simple',
        inner: [
          step({ id: 'begin', kind: 'start', to: 'check' }),
          step({ id: 'check', to: 'pick' }),
          branching({
            id: 'pick',
            kind: 'decision',
            branches: { ok: 'close', redo: 'check' },
          }),
          end({ id: 'close' }),
          step({ id: 'orphan' }),
        ],
      }),
      step({ id: 'simple', kind: 'subprocess', to: 'end' }),
      end({ id: 'end' }),
    ]);

    it('conta as etapas internas que o subprocesso à frente alcança a partir do início dele', () => {
      const run = begin(plan);

      // a, sub/check, sub/pick e simple; sub/orphan não é alcançada.
      expect(runProgress({ plan, run })).toEqual({
        done: 0,
        remaining: 4,
        total: 4,
      });
    });

    it('dentro do subprocesso, soma o que resta dentro e o que vem depois do bloco', () => {
      const run = resolve({ plan, run: begin(plan), stepRef: 'a' });

      expect(runProgress({ plan, run })).toEqual({
        done: 1,
        remaining: 3,
        total: 4,
      });
    });

    it('o subprocesso sem processo interno conta como uma etapa acionável', () => {
      const entered = resolve({ plan, run: begin(plan), stepRef: 'a' });
      const checked = resolve({ plan, run: entered, stepRef: 'sub/check' });
      const left = resolve({
        plan,
        run: checked,
        stepRef: 'sub/pick',
        exitIds: ['ok'],
      });
      const finished = resolve({ plan, run: left, stepRef: 'simple' });

      expect(runProgress({ plan, run: left })).toEqual({
        done: 3,
        remaining: 1,
        total: 4,
      });
      expect(runProgress({ plan, run: finished })).toEqual({
        done: 4,
        remaining: 0,
        total: 4,
      });
    });
  });

  it('não reconta a etapa interna já resolvida enquanto o subprocesso segue aberto', () => {
    const plan = planOf([
      subprocess({
        id: 'sub',
        to: 'end',
        inner: [
          step({ id: 'one', to: 'two' }),
          step({ id: 'two', to: 'close' }),
          end({ id: 'close' }),
        ],
      }),
      end({ id: 'end' }),
    ]);

    const run = resolve({ plan, run: begin(plan), stepRef: 'sub/one' });

    expect(runProgress({ plan, run })).toEqual({
      done: 1,
      remaining: 1,
      total: 2,
    });
  });

  it('ignora a ficha parada numa etapa que o roteiro não tem', () => {
    const stray = { id: 'token-9', stepRef: 'ghost', since: STARTED_AT };
    const started = begin(linear);
    const run: ProcessRun = { ...started, tokens: [...started.tokens, stray] };

    expect(runProgress({ plan: linear, run })).toEqual({
      done: 0,
      remaining: 2,
      total: 2,
    });
  });
});

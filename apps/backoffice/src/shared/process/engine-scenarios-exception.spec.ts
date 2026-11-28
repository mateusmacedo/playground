import { advance } from './engine';
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

const DELIVERED = { kind: 'completed', label: 'Entregue' } as const;
const ESCALATED = { kind: 'expired', label: 'Escalado' } as const;

describe('roteiro: exceção em subprocesso', () => {
  const late = exception({
    id: 'late',
    to: 'escalate',
    trigger: 'timeout',
    timeout: { amount: 1, unit: 'days' },
  });
  const warn = exception({ id: 'warn', to: 'notify', interrupting: false });
  const plan = planOf([
    step({ id: 'start', kind: 'start', to: 'sub' }),
    subprocess({
      id: 'sub',
      to: 'after',
      inner: [
        branching({
          id: 'split',
          kind: 'parallel-split',
          branches: { left: 'x', right: 'y' },
        }),
        step({
          id: 'x',
          kind: 'automated-task',
          to: 'join',
          data: { events: [exception({ id: 'fail', to: 'fix' })] },
        }),
        step({ id: 'y', to: 'join' }),
        step({ id: 'fix', to: 'join' }),
        step({ id: 'join', kind: 'parallel-join', to: 'done' }),
        end({ id: 'done' }),
      ],
      data: { events: [late, warn] },
    }),
    step({ id: 'after', to: 'end' }),
    step({ id: 'notify', to: 'end' }),
    step({ id: 'escalate', to: 'escalated' }),
    end({ id: 'end', outcome: DELIVERED }),
    end({ id: 'escalated', outcome: ESCALATED }),
  ]);

  it('a exceção que interrompe o subprocesso tira a ficha de escopo e todas as internas', () => {
    const waited = resolve({ plan, run: begin(plan), stepRef: 'sub/y' });
    const tokenId = tokenAt({ run: waited, stepRef: 'sub' }).id;
    const at = '2026-11-28T10:00:00.000Z';

    const escalated = act({
      plan,
      run: waited,
      action: { kind: 'raise', tokenId, eventId: 'late' },
      at,
    });
    const finished = resolve({ plan, run: escalated, stepRef: 'escalate' });

    expect(tokenRefs(waited)).toEqual(['sub', 'sub/x', 'sub/join']);
    expect(tokenRefs(escalated)).toEqual(['escalate']);
    expect(escalated.takenExits).toContain('sub:late');
    expect(escalated.log.at(-1)).toMatchObject({
      kind: 'event',
      stepRef: 'sub',
      detail: 'late',
    });
    expect(finished).toMatchObject({ status: 'completed', outcome: ESCALATED });
  });

  it('a ficha interna interrompida não pode mais ser acionada', () => {
    const run = begin(plan);
    const inner = tokenAt({ run, stepRef: 'sub/x' }).id;
    const tokenId = tokenAt({ run, stepRef: 'sub' }).id;
    const escalated = act({
      plan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'late' },
    });

    const result = advance({
      plan,
      run: escalated,
      action: { kind: 'complete', tokenId: inner },
      at: ACTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'unknown-token' } });
  });

  it('a exceção que não interrompe abre um caminho na raiz e o subprocesso continua', () => {
    const run = begin(plan);
    const tokenId = tokenAt({ run, stepRef: 'sub' }).id;

    const warned = act({
      plan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'warn' },
    });
    const first = resolve({ plan, run: warned, stepRef: 'sub/x' });
    const second = resolve({ plan, run: first, stepRef: 'sub/y' });
    const notified = resolve({ plan, run: second, stepRef: 'notify' });
    const finished = resolve({ plan, run: notified, stepRef: 'after' });

    expect(tokenRefs(warned)).toEqual(['sub', 'sub/x', 'sub/y', 'notify']);
    expect(tokenRefs(second)).toEqual(['notify', 'after']);
    expect(notified.status).toBe('running');
    expect(finished).toMatchObject({ status: 'completed', outcome: DELIVERED });
  });

  it('a exceção de uma etapa interna desvia dentro do próprio subprocesso', () => {
    const run = begin(plan);
    const tokenId = tokenAt({ run, stepRef: 'sub/x' }).id;

    const failed = act({
      plan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'fail' },
    });
    const fixed = resolve({ plan, run: failed, stepRef: 'sub/fix' });
    const joined = resolve({ plan, run: fixed, stepRef: 'sub/y' });

    expect(tokenRefs(failed)).toEqual(['sub', 'sub/y', 'sub/fix']);
    expect(failed.takenExits).toContain('sub/x:fail');
    expect(tokenRefs(fixed)).toEqual(['sub', 'sub/y', 'sub/join']);
    expect(tokenRefs(joined)).toEqual(['after']);
  });

  it('a exceção do subprocesso de fora tira as fichas de todos os níveis de dentro', () => {
    const deep = planOf([
      subprocess({
        id: 'outer',
        to: 'end',
        inner: [subprocess({ id: 'inner', inner: [step({ id: 'check' })] })],
        data: { events: [exception({ id: 'boom', to: 'fix' })] },
      }),
      step({ id: 'fix', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const run = begin(deep);
    const tokenId = tokenAt({ run, stepRef: 'outer' }).id;

    const moved = act({
      plan: deep,
      run,
      action: { kind: 'raise', tokenId, eventId: 'boom' },
    });

    expect(tokenRefs(run)).toEqual([
      'outer',
      'outer/inner',
      'outer/inner/check',
    ]);
    expect(tokenRefs(moved)).toEqual(['fix']);
  });
});

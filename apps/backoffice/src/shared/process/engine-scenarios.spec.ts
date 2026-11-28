import { runProgress } from './engine-progress';
import {
  begin,
  branching,
  end,
  planOf,
  resolve,
  step,
  subprocess,
  tokenRefs,
} from './engine-test-kit';

const DELIVERED = { kind: 'completed', label: 'Entregue' } as const;
const REFUSED = { kind: 'rejected', label: 'Recusado' } as const;

describe('roteiro: paralelo dentro de subprocesso', () => {
  const plan = planOf([
    step({ id: 'start', kind: 'start', to: 'sub' }),
    subprocess({
      id: 'sub',
      to: 'review',
      inner: [
        step({ id: 'begin', kind: 'start', to: 'split' }),
        branching({
          id: 'split',
          kind: 'parallel-split',
          branches: { left: 'pack', right: 'bill' },
        }),
        step({ id: 'pack', to: 'join' }),
        step({ id: 'bill', to: 'join' }),
        step({ id: 'join', kind: 'parallel-join', to: 'close' }),
        step({ id: 'close', to: 'done' }),
        end({ id: 'done' }),
      ],
    }),
    step({ id: 'review', to: 'end' }),
    end({ id: 'end', outcome: DELIVERED }),
  ]);

  it('abre os dois caminhos dentro do subprocesso, com a ficha de escopo no bloco', () => {
    const run = begin(plan);

    expect(tokenRefs(run)).toEqual(['sub', 'sub/pack', 'sub/bill']);
    expect(runProgress({ plan, run })).toEqual({
      done: 0,
      remaining: 4,
      total: 4,
    });
  });

  it('sincroniza os caminhos internos, sai do subprocesso e termina na raiz', () => {
    const packed = resolve({ plan, run: begin(plan), stepRef: 'sub/pack' });
    const billed = resolve({ plan, run: packed, stepRef: 'sub/bill' });
    const closed = resolve({ plan, run: billed, stepRef: 'sub/close' });
    const finished = resolve({ plan, run: closed, stepRef: 'review' });

    expect(tokenRefs(packed)).toEqual(['sub', 'sub/bill', 'sub/join']);
    expect(tokenRefs(billed)).toEqual(['sub', 'sub/close']);
    expect(tokenRefs(closed)).toEqual(['review']);
    expect(finished).toMatchObject({ status: 'completed', outcome: DELIVERED });
    expect(runProgress({ plan, run: finished })).toEqual({
      done: 4,
      remaining: 0,
      total: 4,
    });
  });
});

describe('roteiro: decisão dentro de paralelo', () => {
  const plan = planOf([
    step({ id: 'start', kind: 'start', to: 'split' }),
    branching({
      id: 'split',
      kind: 'parallel-split',
      branches: { left: 'check', right: 'pay' },
    }),
    step({ id: 'check', to: 'pick' }),
    branching({
      id: 'pick',
      kind: 'decision',
      branches: { ok: 'join', stop: 'refused' },
    }),
    step({ id: 'pay', to: 'join' }),
    step({ id: 'join', kind: 'parallel-join', to: 'ship' }),
    step({ id: 'ship', to: 'done' }),
    end({ id: 'refused', outcome: REFUSED }),
    end({ id: 'done', outcome: DELIVERED }),
  ]);

  it('quando a decisão segue para a junção, ela espera os dois caminhos', () => {
    const checked = resolve({ plan, run: begin(plan), stepRef: 'check' });
    const picked = resolve({
      plan,
      run: checked,
      stepRef: 'pick',
      exitIds: ['ok'],
    });
    const paid = resolve({ plan, run: picked, stepRef: 'pay' });

    expect(tokenRefs(picked)).toEqual(['pay', 'join']);
    expect(tokenRefs(paid)).toEqual(['ship']);
  });

  it('quando a decisão desvia para um Fim, a junção dispara só com o outro caminho', () => {
    const checked = resolve({ plan, run: begin(plan), stepRef: 'check' });
    const stopped = resolve({
      plan,
      run: checked,
      stepRef: 'pick',
      exitIds: ['stop'],
    });
    const paid = resolve({ plan, run: stopped, stepRef: 'pay' });
    const shipped = resolve({ plan, run: paid, stepRef: 'ship' });

    expect(stopped.status).toBe('running');
    expect(tokenRefs(stopped)).toEqual(['pay']);
    expect(tokenRefs(paid)).toEqual(['ship']);
    expect(shipped).toMatchObject({ status: 'completed', outcome: DELIVERED });
  });

  it('a junção que já esperava dispara no mesmo avanço em que a decisão desvia', () => {
    const paid = resolve({ plan, run: begin(plan), stepRef: 'pay' });
    const checked = resolve({ plan, run: paid, stepRef: 'check' });

    const stopped = resolve({
      plan,
      run: checked,
      stepRef: 'pick',
      exitIds: ['stop'],
    });

    expect(tokenRefs(checked)).toEqual(['join', 'pick']);
    expect(tokenRefs(stopped)).toEqual(['ship']);
    expect(stopped.log.map((event) => event.kind)).toEqual([
      'started',
      'step',
      'step',
      'choice',
      'path-ended',
    ]);
  });
});

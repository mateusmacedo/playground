import { advance } from './engine';
import { runProgress } from './engine-progress';
import {
  ACTED_AT,
  approval,
  begin,
  end,
  planOf,
  resolve,
  step,
  tokenRefs,
} from './engine-test-kit';

const DELIVERED = { kind: 'completed', label: 'Entregue' } as const;

describe('roteiro: laço com saída', () => {
  const plan = planOf([
    step({ id: 'start', kind: 'start', to: 'merge' }),
    step({ id: 'merge', kind: 'merge', to: 'draft' }),
    step({ id: 'draft', to: 'review' }),
    approval({ id: 'review', approved: 'publish', rejected: 'merge' }),
    step({ id: 'publish', to: 'end' }),
    end({ id: 'end', outcome: DELIVERED }),
  ]);

  it('a rejeição volta pela convergência, com ficha nova, e a aprovação sai do laço', () => {
    const drafted = resolve({ plan, run: begin(plan), stepRef: 'draft' });
    const rejected = resolve({
      plan,
      run: drafted,
      stepRef: 'review',
      exitIds: ['rejected'],
      note: 'Falta revisar os números.',
    });
    const redone = resolve({ plan, run: rejected, stepRef: 'draft' });
    const approved = resolve({
      plan,
      run: redone,
      stepRef: 'review',
      exitIds: ['approved'],
    });
    const finished = resolve({ plan, run: approved, stepRef: 'publish' });

    expect(rejected.tokens).toEqual([
      { id: 'token-3', stepRef: 'draft', since: ACTED_AT },
    ]);
    expect(tokenRefs(approved)).toEqual(['publish']);
    expect(finished).toMatchObject({ status: 'completed', outcome: DELIVERED });
    expect(finished.takenExits).toEqual([
      'start:out',
      'merge:out',
      'draft:out',
      'review:rejected',
      'review:approved',
      'publish:out',
    ]);
    expect(finished.log.map((event) => event.kind)).toEqual([
      'started',
      'step',
      'approval',
      'step',
      'approval',
      'step',
      'path-ended',
      'finished',
    ]);
  });

  it('a ficha da volta anterior não resolve a etapa da volta seguinte', () => {
    const drafted = resolve({ plan, run: begin(plan), stepRef: 'draft' });
    const rejected = resolve({
      plan,
      run: drafted,
      stepRef: 'review',
      exitIds: ['rejected'],
      note: 'De novo.',
    });

    const repeated = advance({
      plan,
      run: rejected,
      action: { kind: 'complete', tokenId: 'token-1' },
      at: ACTED_AT,
    });

    expect(repeated).toMatchObject({ refusal: { code: 'unknown-token' } });
  });

  it('o andamento conta a etapa refeita como feita e como restante', () => {
    const started = begin(plan);
    const drafted = resolve({ plan, run: started, stepRef: 'draft' });
    const rejected = resolve({
      plan,
      run: drafted,
      stepRef: 'review',
      exitIds: ['rejected'],
      note: 'De novo.',
    });
    const redone = resolve({ plan, run: rejected, stepRef: 'draft' });
    const approved = resolve({
      plan,
      run: redone,
      stepRef: 'review',
      exitIds: ['approved'],
    });

    expect(runProgress({ plan, run: started })).toEqual({
      done: 0,
      remaining: 3,
      total: 3,
    });
    expect(runProgress({ plan, run: drafted })).toEqual({
      done: 1,
      remaining: 3,
      total: 4,
    });
    expect(runProgress({ plan, run: rejected })).toEqual({
      done: 2,
      remaining: 3,
      total: 5,
    });
    expect(runProgress({ plan, run: approved })).toEqual({
      done: 2,
      remaining: 1,
      total: 3,
    });
  });
});

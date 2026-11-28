import { advance } from './engine';
import {
  ACTED_AT,
  act,
  begin,
  end,
  exception,
  planOf,
  resolve,
  STARTED_AT,
  step,
  subprocess,
  tokenAt,
  tokenRefs,
} from './engine-test-kit';
import { parallelPlan, stoppedAt } from './engine-test-plans';

const NOT_ACTIONABLE = {
  ok: false,
  refusal: {
    code: 'not-actionable',
    message: 'Esta etapa não espera uma ação agora.',
  },
};

describe('advance com raise', () => {
  const failing = step({
    id: 'a',
    kind: 'automated-task',
    to: 'done',
    data: { events: [exception({ id: 'boom', to: 'other' })] },
  });

  it('a exceção que interrompe tira a ficha da etapa e segue pela saída da exceção', () => {
    const { plan, run, tokenId } = stoppedAt(failing);

    const moved = act({
      plan,
      run,
      action: {
        kind: 'raise',
        tokenId,
        eventId: 'boom',
        note: 'Sistema fora.',
      },
      by: 'Ana',
    });

    expect(tokenRefs(moved)).toEqual(['other']);
    expect(moved.takenExits).toEqual(['start:out', 'a:boom']);
    expect(moved.log.at(-1)).toEqual({
      at: ACTED_AT,
      kind: 'event',
      stepRef: 'a',
      label: 'a',
      detail: 'boom',
      note: 'Sistema fora.',
      by: 'Ana',
    });
  });

  it('a exceção que não interrompe abre um caminho a mais e mantém a etapa', () => {
    const events = [
      exception({ id: 'warn', to: 'other', interrupting: false }),
    ];
    const subject = step({ id: 'a', to: 'done', data: { events } });
    const { plan, run, tokenId } = stoppedAt(subject);

    const moved = act({
      plan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'warn' },
    });

    expect(moved.tokens).toEqual([
      { id: tokenId, stepRef: 'a', since: STARTED_AT },
      { id: 'token-2', stepRef: 'other', since: ACTED_AT },
    ]);
    expect(moved.takenExits).toContain('a:warn');
  });

  it('a etapa mantida depois da exceção ainda pode ser concluída', () => {
    const events = [
      exception({ id: 'warn', to: 'other', interrupting: false }),
    ];
    const subject = step({ id: 'a', to: 'done', data: { events } });
    const { plan, run, tokenId } = stoppedAt(subject);
    const raised = act({
      plan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'warn' },
    });

    const moved = resolve({ plan, run: raised, stepRef: 'a' });

    expect(tokenRefs(moved)).toEqual(['other', 'done']);
  });

  it('recusa a exceção que a etapa não tem', () => {
    const { plan, run, tokenId } = stoppedAt(failing);

    const result = advance({
      plan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'ghost' },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'unknown-event',
        message: 'Esta exceção não existe nesta etapa.',
      },
    });
  });

  it('recusa exceção na etapa que não tem nenhuma', () => {
    const { plan, run, tokenId } = stoppedAt(step({ id: 'a', to: 'done' }));

    const result = advance({
      plan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'boom' },
      at: ACTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'unknown-event' } });
  });

  it('recusa exceção pela ficha em espera numa junção', () => {
    const run = resolve({
      plan: parallelPlan,
      run: begin(parallelPlan),
      stepRef: 'a',
    });
    const tokenId = tokenAt({ run, stepRef: 'join' }).id;

    const result = advance({
      plan: parallelPlan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'boom' },
      at: ACTED_AT,
    });

    expect(result).toEqual(NOT_ACTIONABLE);
  });

  it('a exceção sem destino encerra o caminho', () => {
    const events = [exception({ id: 'boom' })];
    const subject = step({ id: 'a', to: 'done', data: { events } });
    const { plan, run, tokenId } = stoppedAt(subject);

    const moved = act({
      plan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'boom' },
    });

    expect(moved.status).toBe('completed');
    expect(moved.outcome).toEqual({
      kind: 'other',
      label: 'Caminho sem continuação',
    });
  });

  it('registra "antes do previsto" na exceção por tempo acionada antes da hora', () => {
    const late = exception({
      id: 'late',
      to: 'other',
      trigger: 'timeout',
      timeout: { amount: 2, unit: 'hours' },
    });
    const subject = step({ id: 'a', to: 'done', data: { events: [late] } });
    const { plan, run, tokenId } = stoppedAt(subject);
    const action = { kind: 'raise', tokenId, eventId: 'late' } as const;

    const early = act({ plan, run, action });
    const onTime = act({ plan, run, action, at: '2026-11-26T12:00:00.000Z' });

    expect(early.log.at(-1)?.detail).toBe('late (antes do previsto)');
    expect(onTime.log.at(-1)?.detail).toBe('late');
  });

  it('usa o gatilho como nome da exceção sem rótulo', () => {
    const events = [
      { ...exception({ id: 'boom', to: 'other' }), label: ' ' },
      {
        ...exception({ id: 'late', to: 'other', trigger: 'timeout' }),
        label: '',
      },
    ];
    const subject = step({ id: 'a', to: 'done', data: { events } });
    const { plan, run, tokenId } = stoppedAt(subject);

    const failed = act({
      plan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'boom' },
    });
    const expired = act({
      plan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'late' },
    });

    expect(failed.log.at(-1)?.detail).toBe('Erro técnico');
    expect(expired.log.at(-1)?.detail).toBe('Tempo esgotado');
  });

  it('a exceção que interrompe o subprocesso tira também as fichas de dentro', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'sub' }),
      subprocess({
        id: 'sub',
        to: 'end',
        inner: [step({ id: 'check' })],
        data: { events: [exception({ id: 'boom', to: 'fix' })] },
      }),
      step({ id: 'fix', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const run = begin(plan);
    const tokenId = tokenAt({ run, stepRef: 'sub' }).id;

    const moved = act({
      plan,
      run,
      action: { kind: 'raise', tokenId, eventId: 'boom' },
    });

    expect(tokenRefs(run)).toEqual(['sub', 'sub/check']);
    expect(tokenRefs(moved)).toEqual(['fix']);
  });
});

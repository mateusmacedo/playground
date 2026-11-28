import { advance } from './engine';
import {
  ACTED_AT,
  act,
  begin,
  resolve,
  STARTED_AT,
  tokenAt,
  tokenRefs,
} from './engine-test-kit';
import { linearPlan, nestedPlan, parallelPlan } from './engine-test-plans';
import type { ProcessRun } from './run';

describe('advance com cancel', () => {
  it('encerra a execução, tira as fichas e registra onde ela parou', () => {
    const run = begin(parallelPlan);

    const cancelled = act({
      plan: parallelPlan,
      run,
      action: { kind: 'cancel', note: ' Pedido desistiu. ' },
      by: 'Ana',
    });

    expect(cancelled).toMatchObject({
      status: 'cancelled',
      endedAt: ACTED_AT,
      tokens: [],
    });
    expect(cancelled.outcome).toBeUndefined();
    expect(cancelled.log.at(-1)).toEqual({
      at: ACTED_AT,
      kind: 'cancelled',
      label: 'Processo cancelado',
      detail: 'Etapas pendentes: a, b',
      note: 'Pedido desistiu.',
      by: 'Ana',
    });
  });

  it('cita só as etapas que esperavam uma ação', () => {
    const waiting = resolve({
      plan: parallelPlan,
      run: begin(parallelPlan),
      stepRef: 'a',
    });
    const inside = begin(nestedPlan);

    const first = act({
      plan: parallelPlan,
      run: waiting,
      action: { kind: 'cancel' },
    });
    const second = act({
      plan: nestedPlan,
      run: inside,
      action: { kind: 'cancel' },
    });

    expect(tokenRefs(waiting)).toEqual(['b', 'join']);
    expect(first.log.at(-1)?.detail).toBe('Etapas pendentes: b');
    expect(tokenRefs(inside)).toEqual(['sub', 'sub/check']);
    expect(second.log.at(-1)?.detail).toBe('Etapas pendentes: check');
  });

  it('não cita etapa quando nenhuma ficha esperava uma ação', () => {
    const run: ProcessRun = { ...begin(linearPlan), tokens: [] };

    const cancelled = act({
      plan: linearPlan,
      run,
      action: { kind: 'cancel' },
    });

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.log.at(-1)?.detail).toBeUndefined();
  });

  it('ignora a ficha parada fora do roteiro ao citar as etapas', () => {
    const run: ProcessRun = {
      ...begin(linearPlan),
      tokens: [{ id: 'token-9', stepRef: 'ghost', since: STARTED_AT }],
    };

    const cancelled = act({
      plan: linearPlan,
      run,
      action: { kind: 'cancel' },
    });

    expect(cancelled.log.at(-1)?.detail).toBeUndefined();
  });
});

describe('advance com delegate e undelegate', () => {
  it('liga a ficha a quem vai executar a etapa e registra no log', () => {
    const run = begin(linearPlan);

    const delegated = act({
      plan: linearPlan,
      run,
      action: { kind: 'delegate', tokenId: 'token-1', delegateId: ' card-9 ' },
      by: 'Ana',
    });

    expect(delegated.tokens).toEqual([
      { id: 'token-1', stepRef: 'a', since: STARTED_AT, delegateId: 'card-9' },
    ]);
    expect(delegated.log.at(-1)).toEqual({
      at: ACTED_AT,
      kind: 'delegated',
      stepRef: 'a',
      label: 'a',
      by: 'Ana',
    });
  });

  it('só muda a ficha delegada', () => {
    const run = begin(parallelPlan);
    const tokenId = tokenAt({ run, stepRef: 'b' }).id;

    const delegated = act({
      plan: parallelPlan,
      run,
      action: { kind: 'delegate', tokenId, delegateId: 'card-9' },
    });

    expect(tokenAt({ run: delegated, stepRef: 'a' }).delegateId).toBe(
      undefined,
    );
    expect(tokenAt({ run: delegated, stepRef: 'b' }).delegateId).toBe('card-9');
  });

  it('recusa delegar a etapa que já está delegada', () => {
    const delegated = act({
      plan: linearPlan,
      run: begin(linearPlan),
      action: { kind: 'delegate', tokenId: 'token-1', delegateId: 'card-9' },
    });

    const result = advance({
      plan: linearPlan,
      run: delegated,
      action: { kind: 'delegate', tokenId: 'token-1', delegateId: 'card-10' },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'already-delegated',
        message: 'Esta etapa já está delegada.',
      },
    });
  });

  it('recusa delegar sem dizer quem vai executar', () => {
    const result = advance({
      plan: linearPlan,
      run: begin(linearPlan),
      action: { kind: 'delegate', tokenId: 'token-1', delegateId: '  ' },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'delegate-required',
        message: 'Informe quem vai executar a etapa.',
      },
    });
  });

  it('recusa delegar a ficha em espera numa junção', () => {
    const run = resolve({
      plan: parallelPlan,
      run: begin(parallelPlan),
      stepRef: 'a',
    });
    const tokenId = tokenAt({ run, stepRef: 'join' }).id;

    const result = advance({
      plan: parallelPlan,
      run,
      action: { kind: 'delegate', tokenId, delegateId: 'card-9' },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'not-actionable',
        message: 'Esta etapa não espera uma ação agora.',
      },
    });
  });

  it('recusa delegar o subprocesso em andamento', () => {
    const run = begin(nestedPlan);
    const tokenId = tokenAt({ run, stepRef: 'sub' }).id;

    const result = advance({
      plan: nestedPlan,
      run,
      action: { kind: 'delegate', tokenId, delegateId: 'card-9' },
      at: ACTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'not-actionable' } });
  });

  it('recusa delegar a ficha parada numa etapa que o motor atravessa sozinho', () => {
    const run: ProcessRun = {
      ...begin(linearPlan),
      tokens: [{ id: 'token-9', stepRef: 'start', since: STARTED_AT }],
    };

    const result = advance({
      plan: linearPlan,
      run,
      action: { kind: 'delegate', tokenId: 'token-9', delegateId: 'card-9' },
      at: ACTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'not-actionable' } });
  });

  it('desfaz a delegação sem mexer no resto da ficha', () => {
    const delegated = act({
      plan: linearPlan,
      run: begin(linearPlan),
      action: { kind: 'delegate', tokenId: 'token-1', delegateId: 'card-9' },
    });

    const released = act({
      plan: linearPlan,
      run: delegated,
      action: { kind: 'undelegate', tokenId: 'token-1' },
    });

    expect(released.tokens).toEqual([
      { id: 'token-1', stepRef: 'a', since: STARTED_AT },
    ]);
    expect(released.log).toBe(delegated.log);
  });

  it('devolve a mesma execução ao desfazer uma delegação que não existe', () => {
    const run = begin(linearPlan);

    const released = act({
      plan: linearPlan,
      run,
      action: { kind: 'undelegate', tokenId: 'token-1' },
    });

    expect(released).toBe(run);
  });

  it('a ficha da etapa seguinte nasce sem delegação', () => {
    const delegated = act({
      plan: linearPlan,
      run: begin(linearPlan),
      action: { kind: 'delegate', tokenId: 'token-1', delegateId: 'card-9' },
    });

    const moved = resolve({ plan: linearPlan, run: delegated, stepRef: 'a' });

    expect(tokenAt({ run: moved, stepRef: 'b' }).delegateId).toBeUndefined();
  });
});

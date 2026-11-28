import { advance, startRun } from './engine';
import {
  ACTED_AT,
  act,
  begin,
  end,
  planOf,
  resolve,
  STARTED_AT,
  step,
  tokenAt,
  tokenRefs,
} from './engine-test-kit';
import { linearPlan } from './engine-test-plans';
import type { ProcessRun } from './run';

const DELIVERED = { kind: 'completed', label: 'Entregue' } as const;

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) {
      deepFreeze(item);
    }
  }
  return value;
}

describe('startRun', () => {
  it('para a ficha na primeira etapa que espera uma ação e registra o início', () => {
    const result = startRun({
      definitionId: 'process-7',
      version: 3,
      name: 'Atendimento',
      plan: linearPlan,
      at: STARTED_AT,
      by: ' Ana ',
    });

    expect(result).toEqual({
      ok: true,
      run: {
        definitionId: 'process-7',
        version: 3,
        name: 'Atendimento',
        status: 'running',
        startedAt: STARTED_AT,
        tokens: [{ id: 'token-1', stepRef: 'a', since: STARTED_AT }],
        log: [
          { at: STARTED_AT, kind: 'started', label: 'Atendimento', by: 'Ana' },
        ],
        nextToken: 2,
        takenExits: ['start:out'],
      },
    });
  });

  it('recusa o roteiro sem a etapa de início', () => {
    const result = startRun({
      definitionId: 'process-7',
      version: 1,
      name: 'Atendimento',
      plan: { startId: 'ghost', steps: linearPlan.steps },
      at: STARTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'invalid-plan',
        message: 'O processo não tem um Início válido.',
      },
    });
  });

  it('recusa o roteiro que entra num laço só de etapas automáticas', () => {
    const looping = planOf([
      step({ id: 'start', kind: 'start', to: 'first' }),
      step({ id: 'first', kind: 'merge', to: 'second' }),
      step({ id: 'second', kind: 'merge', to: 'first' }),
    ]);

    const result = startRun({
      definitionId: 'process-7',
      version: 1,
      name: 'Atendimento',
      plan: looping,
      at: STARTED_AT,
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

  it('conclui na hora o processo que vai do Início direto ao Fim', () => {
    const direct = planOf([
      step({ id: 'start', kind: 'start', to: 'end' }),
      end({ id: 'end', outcome: DELIVERED }),
    ]);

    const run = begin(direct);

    expect(run).toMatchObject({
      status: 'completed',
      endedAt: STARTED_AT,
      outcome: DELIVERED,
      tokens: [],
    });
    expect(run.log.map((event) => event.kind)).toEqual([
      'started',
      'path-ended',
      'finished',
    ]);
  });
});

describe('advance', () => {
  it('recusa qualquer ação na execução concluída', () => {
    const run = resolve({
      plan: linearPlan,
      run: resolve({ plan: linearPlan, run: begin(linearPlan), stepRef: 'a' }),
      stepRef: 'b',
    });

    const result = advance({
      plan: linearPlan,
      run,
      action: { kind: 'cancel' },
      at: ACTED_AT,
    });

    expect(run.status).toBe('completed');
    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'not-running',
        message: 'O processo não está em andamento.',
      },
    });
  });

  it('recusa qualquer ação na execução cancelada', () => {
    const run = act({
      plan: linearPlan,
      run: begin(linearPlan),
      action: { kind: 'cancel' },
    });

    const result = advance({
      plan: linearPlan,
      run,
      action: { kind: 'complete', tokenId: 'token-1' },
      at: ACTED_AT,
    });

    expect(result).toMatchObject({ refusal: { code: 'not-running' } });
  });

  it('recusa a ficha que não existe', () => {
    const result = advance({
      plan: linearPlan,
      run: begin(linearPlan),
      action: { kind: 'complete', tokenId: 'ghost' },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'unknown-token',
        message: 'Esta etapa não está mais ativa.',
      },
    });
  });

  it('recusa a ação repetida sobre a ficha que já saiu da etapa', () => {
    const run = begin(linearPlan);
    const action = { kind: 'complete', tokenId: 'token-1' } as const;
    const moved = act({ plan: linearPlan, run, action });

    const repeated = advance({
      plan: linearPlan,
      run: moved,
      action,
      at: ACTED_AT,
    });

    expect(tokenRefs(moved)).toEqual(['b']);
    expect(repeated).toMatchObject({ refusal: { code: 'unknown-token' } });
  });

  it('recusa a ficha parada numa etapa que o roteiro não tem', () => {
    const run: ProcessRun = {
      ...begin(linearPlan),
      tokens: [{ id: 'token-9', stepRef: 'ghost', since: STARTED_AT }],
    };

    const result = advance({
      plan: linearPlan,
      run,
      action: { kind: 'complete', tokenId: 'token-9' },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'unknown-step',
        message: 'Esta etapa não existe no roteiro do processo.',
      },
    });
  });

  it('devolve uma execução nova e não muda a recebida nem o roteiro', () => {
    const plan = deepFreeze(structuredClone(linearPlan));
    const run = deepFreeze(begin(plan));
    const before = structuredClone(run);

    const moved = act({
      plan,
      run,
      action: { kind: 'complete', tokenId: 'token-1' },
    });

    expect(run).toEqual(before);
    expect(moved).not.toBe(run);
    expect(tokenRefs(moved)).toEqual(['b']);
  });

  it('usa o instante informado na ficha nova e no log, sem ler o relógio', () => {
    const at = '2031-01-02T03:04:05.000Z';

    const moved = act({
      plan: linearPlan,
      run: begin(linearPlan),
      action: { kind: 'complete', tokenId: 'token-1' },
      at,
    });

    expect(tokenAt({ run: moved, stepRef: 'b' }).since).toBe(at);
    expect(moved.log.at(-1)?.at).toBe(at);
  });

  it('dá um id novo à ficha a cada parada e avança o contador', () => {
    const moved = resolve({
      plan: linearPlan,
      run: begin(linearPlan),
      stepRef: 'a',
    });

    expect(moved.tokens).toEqual([
      { id: 'token-2', stepRef: 'b', since: ACTED_AT },
    ]);
    expect(moved.nextToken).toBe(3);
  });

  it('mantém o log no limite, sem perder o início', () => {
    const run = begin(linearPlan);
    const filler = Array.from({ length: 299 }, () => run.log[0]);
    const full: ProcessRun = { ...run, log: [...run.log, ...filler] };

    const moved = resolve({ plan: linearPlan, run: full, stepRef: 'a' });

    expect(moved.log).toHaveLength(300);
    expect(moved.log[0]).toBe(run.log[0]);
    expect(moved.log.at(-1)).toMatchObject({ kind: 'step', stepRef: 'a' });
  });
});

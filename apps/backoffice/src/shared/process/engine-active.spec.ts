import { type ActiveStep, activeSteps } from './engine-active';
import {
  act,
  approval,
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
  waitEvent,
} from './engine-test-kit';
import type { PlanStep } from './plan';
import type { ProcessRun } from './run';

/** Etapas ativas da execução que acabou de começar num roteiro só com a etapa dada. */
function activeAt(subject: PlanStep): readonly ActiveStep[] {
  const plan = planOf([subject, end({ id: 'end' })]);
  return activeSteps({ plan, run: begin(plan) });
}

describe('activeSteps', () => {
  const late = exception({
    id: 'late',
    to: 'end',
    trigger: 'timeout',
    timeout: { amount: 1, unit: 'days' },
  });
  const boom = exception({ id: 'boom', to: 'end' });
  const work = step({
    id: 'work',
    kind: 'human-task',
    to: 'end',
    data: {
      role: 'Analista',
      dueIn: { amount: 2, unit: 'days' },
      events: [late, boom],
    },
  });

  it('descreve a tarefa pendente com o prazo, a ação que a resolve e as exceções', () => {
    const plan = planOf([work, end({ id: 'end' })]);
    const run = begin(plan);

    expect(activeSteps({ plan, run })).toEqual([
      {
        token: { id: 'token-1', stepRef: 'work', since: STARTED_AT },
        step: work,
        trail: [],
        state: 'pending',
        dueAt: '2026-11-28T10:00:00.000Z',
        resolution: 'complete',
        choices: [],
        multiple: false,
        events: [
          { event: late, dueAt: '2026-11-27T10:00:00.000Z' },
          { event: boom, dueAt: undefined },
        ],
        canDelegate: true,
      },
    ]);
  });

  it('não oferece delegar a etapa que já está delegada', () => {
    const plan = planOf([work, end({ id: 'end' })]);
    const run = act({
      plan,
      run: begin(plan),
      action: { kind: 'delegate', tokenId: 'token-1', delegateId: 'card-9' },
    });

    const [active] = activeSteps({ plan, run });

    expect(active.token.delegateId).toBe('card-9');
    expect(active.canDelegate).toBe(false);
  });

  it('a decisão oferece os ramos para uma única escolha', () => {
    const pick = branching({
      id: 'pick',
      kind: 'decision',
      branches: { yes: 'end', no: undefined },
    });

    const [active] = activeAt(pick);

    expect(active).toMatchObject({
      resolution: 'choose',
      choices: pick.exits,
      multiple: false,
      events: [],
      canDelegate: true,
    });
    expect(active.dueAt).toBeUndefined();
  });

  it('a decisão inclusiva aceita mais de um ramo', () => {
    const pick = branching({
      id: 'pick',
      kind: 'inclusive-split',
      branches: { yes: 'end', no: undefined },
    });

    const [active] = activeAt(pick);

    expect(active).toMatchObject({ resolution: 'choose', multiple: true });
    expect(active.choices).toEqual(pick.exits);
  });

  it('a espera por evento só oferece o prazo expirado quando tem prazo', () => {
    const deadline = { amount: 3, unit: 'hours' } as const;

    const [open] = activeAt(waitEvent({ id: 'wait', received: 'end' }));
    const [timed] = activeAt(
      waitEvent({ id: 'wait', received: 'end', deadline }),
    );

    expect(open.choices.map((exit) => exit.id)).toEqual(['received']);
    expect(open.dueAt).toBeUndefined();
    expect(timed.choices.map((exit) => exit.id)).toEqual([
      'received',
      'expired',
    ]);
    expect(timed.dueAt).toBe('2026-11-26T13:00:00.000Z');
  });

  it('a aprovação oferece aprovar e rejeitar, com o prazo da atividade', () => {
    const review = approval({
      id: 'review',
      approved: 'end',
      data: { dueIn: { amount: 1, unit: 'weeks' } },
    });

    const [active] = activeAt(review);

    expect(active.choices.map((exit) => exit.meaning)).toEqual([
      'approved',
      'rejected',
    ]);
    expect(active.dueAt).toBe('2026-12-03T10:00:00.000Z');
  });

  it('o temporizador se conclui e tem como prazo a duração dele', () => {
    const duration = { amount: 45, unit: 'minutes' } as const;
    const timer = step({ id: 'timer', kind: 'timer', data: { duration } });

    const [active] = activeAt(timer);

    expect(active).toMatchObject({
      resolution: 'complete',
      dueAt: '2026-11-26T10:45:00.000Z',
    });
  });

  it('a ficha em espera numa junção não tem prazo nem ação', () => {
    const plan = planOf([
      branching({
        id: 'split',
        kind: 'parallel-split',
        branches: { left: 'a', right: 'b' },
      }),
      step({ id: 'a', to: 'join' }),
      step({ id: 'b', to: 'join' }),
      step({
        id: 'join',
        kind: 'parallel-join',
        to: 'end',
        data: { dueIn: { amount: 1, unit: 'days' }, events: [boom] },
      }),
      end({ id: 'end' }),
    ]);
    const run = resolve({ plan, run: begin(plan), stepRef: 'a' });

    const active = activeSteps({ plan, run });

    expect(active.map((item) => item.state)).toEqual(['pending', 'waiting']);
    expect(active[1]).toEqual({
      token: tokenAt({ run, stepRef: 'join' }),
      step: plan.steps[3],
      trail: [],
      state: 'waiting',
      choices: [],
      multiple: false,
      events: [],
      canDelegate: false,
    });
  });

  describe('com subprocesso', () => {
    const check = step({ id: 'check' });
    const inner = subprocess({ id: 'inner', inner: [check] });
    const outer = subprocess({
      id: 'outer',
      to: 'end',
      inner: [inner],
      data: { dueIn: { amount: 5, unit: 'days' }, events: [late] },
    });
    const plan = planOf([outer, end({ id: 'end' })]);

    it('o subprocesso em andamento só aceita as exceções dele', () => {
      const [scope] = activeSteps({ plan, run: begin(plan) });

      expect(scope).toEqual({
        token: {
          id: 'token-1',
          stepRef: 'outer',
          since: STARTED_AT,
          scope: true,
        },
        step: outer,
        trail: [],
        state: 'scope',
        dueAt: '2026-12-01T10:00:00.000Z',
        resolution: undefined,
        choices: [],
        multiple: false,
        events: [{ event: late, dueAt: '2026-11-27T10:00:00.000Z' }],
        canDelegate: false,
      });
    });

    it('a etapa interna traz a trilha de subprocessos, do mais externo ao mais próximo', () => {
      const active = activeSteps({ plan, run: begin(plan) });

      expect(active.map((item) => item.token.stepRef)).toEqual([
        'outer',
        'outer/inner',
        'outer/inner/check',
      ]);
      expect(active.map((item) => item.trail)).toEqual([
        [],
        [outer],
        [outer, inner],
      ]);
      expect(active[2]).toMatchObject({ step: check, state: 'pending' });
    });
  });

  it('a execução encerrada não tem etapa ativa', () => {
    const plan = planOf([work, end({ id: 'end' })]);
    const run = begin(plan);
    const cancelled = act({ plan, run, action: { kind: 'cancel' } });
    const completed = resolve({ plan, run, stepRef: 'work' });
    const frozen: ProcessRun = { ...run, status: 'cancelled' };

    expect(activeSteps({ plan, run: cancelled })).toEqual([]);
    expect(activeSteps({ plan, run: completed })).toEqual([]);
    expect(activeSteps({ plan, run: frozen })).toEqual([]);
  });

  it('deixa de fora a ficha parada numa etapa que o roteiro não tem', () => {
    const plan = planOf([work, end({ id: 'end' })]);
    const started = begin(plan);
    const stray = { id: 'token-9', stepRef: 'ghost', since: STARTED_AT };
    const run: ProcessRun = {
      ...started,
      tokens: [stray, ...started.tokens],
    };

    const active = activeSteps({ plan, run });

    expect(active.map((item) => item.token.id)).toEqual(['token-1']);
  });

  it('a ficha parada numa etapa automática não tem ação que a resolva', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'work' }),
      work,
      end({ id: 'end' }),
    ]);
    const stray = { id: 'token-9', stepRef: 'start', since: STARTED_AT };
    const run: ProcessRun = { ...begin(plan), tokens: [stray] };

    const [active] = activeSteps({ plan, run });

    expect(active).toMatchObject({ state: 'pending', canDelegate: false });
    expect(active.resolution).toBeUndefined();
  });
});

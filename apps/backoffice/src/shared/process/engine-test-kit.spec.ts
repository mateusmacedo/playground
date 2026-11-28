import {
  ACTED_AT,
  act,
  approval,
  begin,
  branching,
  end,
  exception,
  placeAt,
  planOf,
  resolve,
  STARTED_AT,
  step,
  subprocess,
  tokenAt,
  tokenRefs,
  waitEvent,
} from './engine-test-kit';

const plan = planOf([
  step({ id: 'start', kind: 'start', to: 'pick' }),
  branching({
    id: 'pick',
    kind: 'decision',
    branches: { yes: 'work', no: undefined },
  }),
  step({ id: 'work', to: 'end' }),
  end({ id: 'end' }),
]);

describe('construtores de etapa', () => {
  it('step cria uma tarefa de saída única com o id como rótulo', () => {
    expect(step({ id: 'work', to: 'end' })).toEqual({
      id: 'work',
      kind: 'task',
      label: 'work',
      exits: [{ id: 'out', meaning: 'next', to: 'end' }],
    });
  });

  it('step aceita o tipo e sobrepõe os dados da etapa', () => {
    const timer = step({
      id: 'wait',
      kind: 'timer',
      data: { label: 'Esperar', exits: [] },
    });

    expect(timer).toMatchObject({ kind: 'timer', label: 'Esperar', exits: [] });
  });

  it('branching cria um ramo por saída, com o id como rótulo', () => {
    const pick = branching({
      id: 'pick',
      kind: 'decision',
      branches: { yes: 'work', no: undefined },
      data: { defaultExitId: 'yes' },
    });

    expect(pick.exits).toEqual([
      { id: 'yes', meaning: 'branch', label: 'yes', to: 'work' },
      { id: 'no', meaning: 'branch', label: 'no', to: undefined },
    ]);
    expect(pick.defaultExitId).toBe('yes');
  });

  it('end cria um Fim sem saída, com o desfecho dado', () => {
    const outcome = { kind: 'rejected', label: 'Recusado' } as const;

    expect(end({ id: 'end', outcome })).toEqual({
      id: 'end',
      kind: 'end',
      label: 'end',
      exits: [],
      outcome,
    });
  });

  it('approval cria as saídas de aprovado e de rejeitado', () => {
    const review = approval({
      id: 'review',
      approved: 'ok',
      rejected: 'redo',
      data: { role: 'Gestor' },
    });

    expect(review.exits).toEqual([
      { id: 'approved', meaning: 'approved', to: 'ok' },
      { id: 'rejected', meaning: 'rejected', to: 'redo' },
    ]);
    expect(review.role).toBe('Gestor');
  });

  it('approval sem dados extras continua sendo uma aprovação', () => {
    expect(approval({ id: 'review' }).kind).toBe('approval');
  });

  it('waitEvent cria as saídas de evento recebido e de prazo expirado', () => {
    const deadline = { amount: 2, unit: 'days' } as const;
    const wait = waitEvent({ id: 'wait', received: 'ok', deadline });

    expect(wait.exits).toEqual([
      { id: 'received', meaning: 'received', to: 'ok' },
      { id: 'expired', meaning: 'expired', to: undefined },
    ]);
    expect(wait.deadline).toBe(deadline);
  });

  it('subprocess guarda o processo interno, que começa na primeira etapa', () => {
    const inner = [step({ id: 'check' })];
    const sub = subprocess({ id: 'sub', to: 'end', inner });

    expect(sub.kind).toBe('subprocess');
    expect(sub.inner).toEqual({ startId: 'check', steps: inner });
    expect(sub.exits).toEqual([{ id: 'out', meaning: 'next', to: 'end' }]);
  });

  it('subprocess aceita dados que trocam o processo interno', () => {
    const sub = subprocess({
      id: 'sub',
      inner: [],
      data: { inner: undefined },
    });

    expect(sub.inner).toBeUndefined();
  });

  it('exception cria uma exceção por erro que interrompe, salvo outro valor', () => {
    expect(exception({ id: 'boom', to: 'fix' })).toEqual({
      id: 'boom',
      label: 'boom',
      trigger: 'error',
      interrupting: true,
      timeout: undefined,
      to: 'fix',
    });
    const late = exception({
      id: 'late',
      interrupting: false,
      trigger: 'timeout',
      timeout: { amount: 1, unit: 'hours' },
    });
    expect(late).toMatchObject({ interrupting: false, trigger: 'timeout' });
  });

  it('planOf começa na primeira etapa e fica sem início quando não há etapas', () => {
    expect(plan.startId).toBe('start');
    expect(planOf([])).toEqual({ startId: '', steps: [] });
  });
});

describe('condutores da execução de teste', () => {
  it('begin inicia a execução no instante de início dos testes', () => {
    const run = begin(plan);

    expect(run.startedAt).toBe(STARTED_AT);
    expect(tokenRefs(run)).toEqual(['pick']);
  });

  it('begin falha o teste quando o motor recusa o roteiro', () => {
    expect(() => begin(planOf([]))).toThrow(
      'Recusa inesperada: O processo não tem um Início válido.',
    );
  });

  it('act aplica a ação no instante padrão e aceita outro instante e o autor', () => {
    const run = begin(plan);
    const tokenId = tokenAt({ run, stepRef: 'pick' }).id;
    const action = { kind: 'choose', tokenId, exitIds: ['yes'] } as const;

    const moved = act({ plan, run, action });
    const later = act({
      plan,
      run,
      action,
      at: '2026-11-27T08:00:00.000Z',
      by: 'Ana',
    });

    expect(tokenAt({ run: moved, stepRef: 'work' }).since).toBe(ACTED_AT);
    expect(tokenAt({ run: later, stepRef: 'work' }).since).toBe(
      '2026-11-27T08:00:00.000Z',
    );
    expect(later.log.at(-1)?.by).toBe('Ana');
  });

  it('act falha o teste quando o motor recusa a ação', () => {
    const run = begin(plan);
    const action = { kind: 'complete', tokenId: 'ghost' } as const;

    expect(() => act({ plan, run, action })).toThrow(
      'Recusa inesperada: Esta etapa não está mais ativa.',
    );
  });

  it('tokenAt falha o teste quando não há ficha na etapa', () => {
    const run = begin(plan);

    expect(() => tokenAt({ run, stepRef: 'work' })).toThrow(
      'Nenhuma ficha em work.',
    );
  });

  it('placeAt localiza a etapa e falha o teste quando o roteiro não a tem', () => {
    expect(placeAt({ plan, stepRef: 'work' }).step.id).toBe('work');
    expect(() => placeAt({ plan, stepRef: 'ghost' })).toThrow(
      'Nenhuma etapa em ghost.',
    );
  });

  it('resolve escolhe os caminhos com exitIds e conclui sem eles', () => {
    const chosen = resolve({
      plan,
      run: begin(plan),
      stepRef: 'pick',
      exitIds: ['yes'],
    });
    const finished = resolve({ plan, run: chosen, stepRef: 'work' });

    expect(tokenRefs(chosen)).toEqual(['work']);
    expect(finished.status).toBe('completed');
  });
});

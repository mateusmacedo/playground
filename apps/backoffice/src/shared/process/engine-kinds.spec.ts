import {
  allowsManyChoices,
  choicesOf,
  eventName,
  exitName,
  innerPlanOf,
  isJoin,
  resolutionOf,
  tokenState,
  waysOf,
} from './engine-kinds';
import {
  approval,
  branching,
  end,
  exception,
  step,
  subprocess,
  waitEvent,
} from './engine-test-kit';
import type { StepKind } from './plan';

const SINCE = '2026-11-26T10:00:00.000Z';

describe('innerPlanOf', () => {
  it('devolve o processo interno do subprocesso que tem a etapa de início', () => {
    const sub = subprocess({ id: 'sub', inner: [step({ id: 'check' })] });

    expect(innerPlanOf(sub)).toBe(sub.inner);
  });

  it('não devolve processo interno sem a etapa de início', () => {
    const inner = { startId: 'ghost', steps: [step({ id: 'check' })] };
    const broken = subprocess({ id: 'sub', inner: [], data: { inner } });
    const empty = subprocess({ id: 'sub', inner: [] });

    expect(innerPlanOf(broken)).toBeUndefined();
    expect(innerPlanOf(empty)).toBeUndefined();
  });

  it('não devolve processo interno de subprocesso sem um nem de etapa de outro tipo', () => {
    const inner = { startId: 'check', steps: [step({ id: 'check' })] };
    const bare = step({ id: 'sub', kind: 'subprocess' });
    const task = step({ id: 'a', data: { inner } });

    expect(innerPlanOf(bare)).toBeUndefined();
    expect(innerPlanOf(task)).toBeUndefined();
  });
});

describe('resolutionOf', () => {
  const completed: readonly StepKind[] = [
    'task',
    'human-task',
    'automated-task',
    'send-message',
    'timer',
  ];
  const chosen: readonly StepKind[] = [
    'decision',
    'inclusive-split',
    'wait-event',
    'approval',
  ];
  const automatic: readonly StepKind[] = [
    'start',
    'merge',
    'parallel-split',
    'parallel-join',
    'inclusive-join',
    'end',
  ];

  it.each(completed)('a etapa do tipo %s se resolve com complete', (kind) => {
    expect(resolutionOf(step({ id: 'a', kind }))).toBe('complete');
  });

  it.each(chosen)('a etapa do tipo %s se resolve com choose', (kind) => {
    expect(resolutionOf(step({ id: 'a', kind }))).toBe('choose');
  });

  it.each(automatic)('a etapa do tipo %s não espera uma ação', (kind) => {
    expect(resolutionOf(step({ id: 'a', kind }))).toBeUndefined();
  });

  it('o subprocesso só espera uma conclusão quando não dá para entrar nele', () => {
    const simple = step({ id: 'sub', kind: 'subprocess' });
    const real = subprocess({ id: 'sub', inner: [step({ id: 'check' })] });

    expect(resolutionOf(simple)).toBe('complete');
    expect(resolutionOf(real)).toBeUndefined();
  });
});

describe('isJoin', () => {
  it('reconhece a sincronização paralela e a junção inclusiva', () => {
    expect(isJoin(step({ id: 'a', kind: 'parallel-join' }))).toBe(true);
    expect(isJoin(step({ id: 'a', kind: 'inclusive-join' }))).toBe(true);
  });

  it('não confunde a convergência nem as aberturas com junção', () => {
    expect(isJoin(step({ id: 'a', kind: 'merge' }))).toBe(false);
    expect(isJoin(step({ id: 'a', kind: 'parallel-split' }))).toBe(false);
  });
});

describe('choicesOf', () => {
  it('oferece todos os ramos da decisão e as duas saídas da aprovação', () => {
    const pick = branching({
      id: 'a',
      kind: 'decision',
      branches: { yes: 'b', no: 'c' },
    });
    const review = approval({ id: 'a' });

    expect(choicesOf(pick)).toBe(pick.exits);
    expect(choicesOf(review)).toBe(review.exits);
  });

  it('só oferece o prazo expirado da espera quando ela tem prazo', () => {
    const open = waitEvent({ id: 'a' });
    const timed = waitEvent({ id: 'a', deadline: { amount: 1, unit: 'days' } });

    expect(choicesOf(open).map((exit) => exit.id)).toEqual(['received']);
    expect(choicesOf(timed).map((exit) => exit.id)).toEqual([
      'received',
      'expired',
    ]);
  });

  it('não oferece saída na etapa que não é de escolha', () => {
    expect(choicesOf(step({ id: 'a' }))).toEqual([]);
    expect(choicesOf(step({ id: 'a', kind: 'merge' }))).toEqual([]);
  });
});

describe('allowsManyChoices', () => {
  it('só a decisão inclusiva aceita mais de uma saída', () => {
    expect(allowsManyChoices(step({ id: 'a', kind: 'inclusive-split' }))).toBe(
      true,
    );
    expect(allowsManyChoices(step({ id: 'a', kind: 'decision' }))).toBe(false);
  });
});

describe('exitName', () => {
  it('usa o rótulo da saída, sem espaços nas pontas', () => {
    expect(exitName({ id: 'yes', meaning: 'branch', label: ' Sim ' })).toBe(
      'Sim',
    );
  });

  it.each([
    ['next', 'Seguir'],
    ['branch', 'Ramo'],
    ['received', 'Evento recebido'],
    ['expired', 'Prazo expirado'],
    ['approved', 'Aprovado'],
    ['rejected', 'Rejeitado'],
  ] as const)('sem rótulo, a saída %s se chama %s', (meaning, name) => {
    expect(exitName({ id: 'x', meaning })).toBe(name);
    expect(exitName({ id: 'x', meaning, label: '  ' })).toBe(name);
  });
});

describe('eventName', () => {
  it('usa o rótulo da exceção ou, sem ele, o gatilho', () => {
    const named = { ...exception({ id: 'boom' }), label: ' Falha no envio ' };
    const error = { ...exception({ id: 'boom' }), label: '' };
    const timeout = {
      ...exception({ id: 'late', trigger: 'timeout' }),
      label: ' ',
    };

    expect(eventName(named)).toBe('Falha no envio');
    expect(eventName(error)).toBe('Erro técnico');
    expect(eventName(timeout)).toBe('Tempo esgotado');
  });
});

describe('waysOf', () => {
  it('junta as saídas e as exceções da etapa, nessa ordem', () => {
    const events = [exception({ id: 'boom', to: 'fix' })];
    const task = step({ id: 'a', to: 'b', data: { events } });

    expect(waysOf(task).map((way) => `${way.id}>${way.to}`)).toEqual([
      'out>b',
      'boom>fix',
    ]);
  });

  it('devolve só as saídas da etapa sem exceção e nada para o Fim', () => {
    expect(waysOf(step({ id: 'a', to: 'b' }))).toHaveLength(1);
    expect(waysOf(end({ id: 'end' }))).toEqual([]);
  });
});

describe('tokenState', () => {
  it('distingue a ficha pendente, a em espera numa junção e a de escopo', () => {
    const token = { id: 'token-1', stepRef: 'a', since: SINCE };

    expect(tokenState(token)).toBe('pending');
    expect(tokenState({ ...token, waiting: true })).toBe('waiting');
    expect(tokenState({ ...token, scope: true })).toBe('scope');
  });
});

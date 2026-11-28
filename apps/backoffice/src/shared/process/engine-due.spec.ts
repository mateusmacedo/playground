import {
  addDuration,
  eventDueAt,
  isBeforeDue,
  isOverdue,
  stepDueAt,
} from './engine-due';
import { exception, step, waitEvent } from './engine-test-kit';

const SINCE = '2026-11-26T10:00:00.000Z';

describe('addDuration', () => {
  it.each([
    [{ amount: 30, unit: 'minutes' }, '2026-11-26T10:30:00.000Z'],
    [{ amount: 5, unit: 'hours' }, '2026-11-26T15:00:00.000Z'],
    [{ amount: 3, unit: 'days' }, '2026-11-29T10:00:00.000Z'],
    [{ amount: 2, unit: 'weeks' }, '2026-12-10T10:00:00.000Z'],
  ] as const)('soma %j ao instante', (duration, expected) => {
    expect(addDuration({ from: SINCE, duration })).toBe(expected);
  });

  it('devolve o resultado em ISO 8601 mesmo quando o instante vem com fuso', () => {
    const from = '2026-11-26T07:00:00-03:00';

    expect(addDuration({ from, duration: { amount: 1, unit: 'hours' } })).toBe(
      '2026-11-26T11:00:00.000Z',
    );
  });

  it('devolve o instante como veio quando ele é ilegível', () => {
    const duration = { amount: 1, unit: 'days' } as const;

    expect(addDuration({ from: 'amanhã', duration })).toBe('amanhã');
  });

  it('devolve o instante como veio quando a soma passa do que o Date representa', () => {
    const duration = {
      amount: Number.MAX_SAFE_INTEGER,
      unit: 'weeks',
    } as const;

    expect(addDuration({ from: SINCE, duration })).toBe(SINCE);
  });
});

describe('stepDueAt', () => {
  it('soma o prazo da atividade ao instante em que a ficha chegou', () => {
    const dueIn = { amount: 2, unit: 'days' } as const;
    const task = step({ id: 'a', kind: 'human-task', data: { dueIn } });

    expect(stepDueAt({ step: task, since: SINCE })).toBe(
      '2026-11-28T10:00:00.000Z',
    );
  });

  it('não dá prazo à etapa que não tem', () => {
    expect(
      stepDueAt({ step: step({ id: 'a' }), since: SINCE }),
    ).toBeUndefined();
  });

  it('usa o prazo da espera por evento, e não o da atividade', () => {
    const deadline = { amount: 4, unit: 'hours' } as const;
    const timed = waitEvent({ id: 'a', deadline });
    const open = { ...waitEvent({ id: 'a' }), dueIn: deadline };

    expect(stepDueAt({ step: timed, since: SINCE })).toBe(
      '2026-11-26T14:00:00.000Z',
    );
    expect(stepDueAt({ step: open, since: SINCE })).toBeUndefined();
  });

  it('soma a duração do temporizador', () => {
    const duration = { amount: 90, unit: 'minutes' } as const;
    const timer = step({ id: 'a', kind: 'timer', data: { duration } });

    expect(stepDueAt({ step: timer, since: SINCE })).toBe(
      '2026-11-26T11:30:00.000Z',
    );
  });

  it('lê a data e o horário locais do temporizador que espera até um momento', () => {
    const until = '2026-12-01T09:30';
    const timer = step({ id: 'a', kind: 'timer', data: { until } });

    expect(stepDueAt({ step: timer, since: SINCE })).toBe(
      new Date(2026, 11, 1, 9, 30).toISOString(),
    );
  });

  it('prefere a duração quando o temporizador traz as duas formas', () => {
    const duration = { amount: 1, unit: 'hours' } as const;
    const timer = step({
      id: 'a',
      kind: 'timer',
      data: { duration, until: '2026-12-01T09:30' },
    });

    expect(stepDueAt({ step: timer, since: SINCE })).toBe(
      '2026-11-26T11:00:00.000Z',
    );
  });

  it('não dá prazo ao temporizador sem duração nem momento legível', () => {
    const bare = step({ id: 'a', kind: 'timer' });
    const broken = step({ id: 'a', kind: 'timer', data: { until: 'depois' } });

    expect(stepDueAt({ step: bare, since: SINCE })).toBeUndefined();
    expect(stepDueAt({ step: broken, since: SINCE })).toBeUndefined();
  });
});

describe('eventDueAt', () => {
  it('soma o limite de tempo da exceção por tempo esgotado', () => {
    const event = exception({
      id: 'late',
      trigger: 'timeout',
      timeout: { amount: 1, unit: 'days' },
    });

    expect(eventDueAt({ event, since: SINCE })).toBe(
      '2026-11-27T10:00:00.000Z',
    );
  });

  it('não dá prazo à exceção por erro nem à exceção por tempo sem limite', () => {
    const error = exception({
      id: 'boom',
      timeout: { amount: 1, unit: 'days' },
    });
    const open = exception({ id: 'late', trigger: 'timeout' });

    expect(eventDueAt({ event: error, since: SINCE })).toBeUndefined();
    expect(eventDueAt({ event: open, since: SINCE })).toBeUndefined();
  });
});

describe('isBeforeDue e isOverdue', () => {
  const dueAt = '2026-11-26T12:00:00.000Z';

  it('antes do prazo é antes e não está atrasado', () => {
    const at = '2026-11-26T11:59:59.000Z';

    expect(isBeforeDue({ at, dueAt })).toBe(true);
    expect(isOverdue({ at, dueAt })).toBe(false);
  });

  it('depois do prazo está atrasado e não é antes', () => {
    const at = '2026-11-26T12:00:01.000Z';

    expect(isBeforeDue({ at, dueAt })).toBe(false);
    expect(isOverdue({ at, dueAt })).toBe(true);
  });

  it('na hora exata não é antes nem está atrasado', () => {
    expect(isBeforeDue({ at: dueAt, dueAt })).toBe(false);
    expect(isOverdue({ at: dueAt, dueAt })).toBe(false);
  });

  it('sem prazo nunca é antes nem atrasa', () => {
    expect(isBeforeDue({ at: dueAt, dueAt: undefined })).toBe(false);
    expect(isOverdue({ at: dueAt, dueAt: undefined })).toBe(false);
  });

  it('compara instantes, e não textos, quando os fusos diferem', () => {
    const at = '2026-11-26T10:00:00-03:00';

    expect(isOverdue({ at, dueAt })).toBe(true);
  });
});

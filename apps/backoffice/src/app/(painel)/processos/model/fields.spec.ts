import {
  channelLabel,
  formatDateTime,
  formatDuration,
  formatSchedule,
  isDate,
  isDateTime,
  isDuration,
  isSchedule,
  isTime,
  outcomeText,
} from './fields';

describe('formatos de tempo', () => {
  it('aceita só duração inteira de 1 a 999 numa unidade conhecida', () => {
    expect(isDuration({ amount: 48, unit: 'hours' })).toBe(true);
    expect(isDuration({ amount: 0, unit: 'hours' })).toBe(false);
    expect(isDuration({ amount: 1.5, unit: 'hours' })).toBe(false);
    expect(isDuration({ amount: 1000, unit: 'days' })).toBe(false);
    expect(isDuration({ amount: 2, unit: 'anos' })).toBe(false);
    expect(isDuration('48 horas')).toBe(false);
  });

  it('aceita só horário e data que existem no relógio e no calendário', () => {
    expect(isTime('09:30')).toBe(true);
    expect(isTime('24:00')).toBe(false);
    expect(isTime('9:30')).toBe(false);
    expect(isDate('2028-02-29')).toBe(true);
    expect(isDate('2026-02-29')).toBe(false);
    expect(isDate('2026-04-31')).toBe(false);
    expect(isDateTime('2026-12-01T09:00')).toBe(true);
    expect(isDateTime('2026-12-01')).toBe(false);
  });

  it('exige no agendamento o dia que a recorrência usa', () => {
    expect(isSchedule({ recurrence: 'daily', time: '09:00' })).toBe(true);
    expect(isSchedule({ recurrence: 'once', time: '09:00' })).toBe(false);
    expect(
      isSchedule({ recurrence: 'once', time: '09:00', date: '2026-12-01' }),
    ).toBe(true);
    expect(
      isSchedule({ recurrence: 'weekly', time: '09:00', weekday: 7 }),
    ).toBe(false);
    expect(
      isSchedule({ recurrence: 'monthly', time: '09:00', monthDay: 29 }),
    ).toBe(false);
    expect(
      isSchedule({ recurrence: 'monthly', time: '09:00', monthDay: 'last' }),
    ).toBe(true);
  });

  it('escreve durações, datas e agendamentos em PT-BR', () => {
    expect(formatDuration({ amount: 1, unit: 'hours' })).toBe('1 hora');
    expect(formatDuration({ amount: 48, unit: 'hours' })).toBe('48 horas');
    expect(formatDateTime('2026-12-01T09:00')).toBe('01/12/2026 às 09:00');
    expect(formatSchedule({ recurrence: 'daily', time: '08:00' })).toBe(
      'Todos os dias às 08:00',
    );
    expect(
      formatSchedule({ recurrence: 'weekly', time: '08:00', weekday: 1 }),
    ).toBe('Toda segunda-feira às 08:00');
    expect(
      formatSchedule({
        recurrence: 'monthly',
        time: '08:00',
        monthDay: 'last',
      }),
    ).toBe('No último dia do mês às 08:00');
    expect(
      formatSchedule({ recurrence: 'once', time: '08:00', date: '2026-12-01' }),
    ).toBe('Uma vez, em 01/12/2026 às 08:00');
  });
});

describe('outcomeText', () => {
  it('usa o nome da lista ou, em Outro, o nome dado', () => {
    expect(outcomeText({ outcome: 'rejected' })).toBe('Recusado');
    expect(outcomeText({ outcome: 'other', outcomeLabel: ' Arquivado ' })).toBe(
      'Arquivado',
    );
    expect(outcomeText({})).toBe('');
  });
});

describe('formatos em casos-limite', () => {
  it('recusa agendamento sem formato e recorrência desconhecida', () => {
    expect(isSchedule(null)).toBe(false);
    expect(isSchedule({ recurrence: 'yearly', time: '09:00' })).toBe(false);
    expect(isDate(20261201)).toBe(false);
    expect(isDate('01/12/2026')).toBe(false);
    expect(isDateTime(42)).toBe(false);
  });

  it('nomeia o canal e o dia do agendamento mensal', () => {
    expect(channelLabel('in-app')).toBe('Notificação no sistema');
    expect(
      formatSchedule({ recurrence: 'monthly', time: '07:00', monthDay: 5 }),
    ).toBe('Todo dia 5 às 07:00');
  });
});

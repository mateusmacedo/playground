import { legacyDuration, sanitizeBlockData } from './draft-fields';

describe('legacyDuration', () => {
  it('converte o texto livre reconhecível da versão 1', () => {
    expect(legacyDuration('48 horas')).toEqual({ amount: 48, unit: 'hours' });
    expect(legacyDuration('2 dias')).toEqual({ amount: 2, unit: 'days' });
    expect(legacyDuration('30 min')).toEqual({ amount: 30, unit: 'minutes' });
    expect(legacyDuration('1 semana')).toEqual({ amount: 1, unit: 'weeks' });
  });

  it('não adivinha o que não reconhece', () => {
    expect(legacyDuration('amanhã')).toBeUndefined();
    expect(legacyDuration('0 horas')).toBeUndefined();
    expect(legacyDuration('2 anos')).toBeUndefined();
  });
});

describe('sanitizeBlockData', () => {
  it('mantém os dados válidos sem contar ajuste', () => {
    const result = sanitizeBlockData({
      label: 'Esperar',
      raw: {
        label: 'Esperar',
        timerMode: 'duration',
        duration: { amount: 2, unit: 'days' },
      },
    });

    expect(result).toEqual({
      data: {
        label: 'Esperar',
        timerMode: 'duration',
        duration: { amount: 2, unit: 'days' },
      },
      adjusted: 0,
    });
  });

  it('converte desfecho, canal e prazos em texto e conta os ajustes', () => {
    const result = sanitizeBlockData({
      label: 'X',
      raw: {
        label: 'X',
        outcome: 'Concluído',
        channel: 'E-mail',
        deadline: '48 horas',
        dueIn: 'quando der',
      },
    });

    expect(result.data).toEqual({
      label: 'X',
      outcome: 'completed',
      channel: 'email',
      deadline: { amount: 48, unit: 'hours' },
    });
    expect(result.adjusted).toBe(4);
  });

  it('guarda um desfecho fora da lista como Outro, com o nome dele', () => {
    const { data } = sanitizeBlockData({
      label: 'Fim',
      raw: { label: 'Fim', outcome: 'Arquivado' },
    });

    expect(data).toMatchObject({ outcome: 'other', outcomeLabel: 'Arquivado' });
  });

  it('tira data, agendamento, opção e ramo padrão inválidos', () => {
    const result = sanitizeBlockData({
      label: 'X',
      raw: {
        label: 'X',
        until: '2026-02-30T09:00',
        schedule: { recurrence: 'weekly', time: '25:00', weekday: 1 },
        trigger: 'sempre',
        branches: [{ id: 'a', label: 'A' }, { label: 'sem id' }],
        defaultBranchId: 'sumiu',
      },
    });

    expect(result.data).toEqual({
      label: 'X',
      branches: [{ id: 'a', label: 'A' }],
    });
    expect(result.adjusted).toBe(5);
  });
});

describe('sanitizeBlockData nos tipos errados', () => {
  it('tira texto que não é texto, chave que não é booleana e listas quebradas', () => {
    const result = sanitizeBlockData({
      label: 'X',
      raw: {
        label: 'X',
        description: 42,
        interrupting: 'sim',
        branches: 'Sim, Não',
        channel: 'pombo-correio',
        outcome: '  ',
        duration: '',
      },
    });

    expect(result.data).toEqual({ label: 'X' });
    expect(result.adjusted).toBe(6);
  });

  it('mantém canal, desfecho e escolhas já válidos', () => {
    const result = sanitizeBlockData({
      label: 'X',
      raw: {
        label: 'X',
        channel: 'whatsapp',
        outcome: 'other',
        outcomeLabel: 'Arquivado',
        trigger: 'schedule',
        schedule: { recurrence: 'daily', time: '07:00' },
        exceptionTrigger: 'timeout',
        timerMode: 'until',
        until: '2026-12-01T09:00',
        interrupting: false,
      },
    });

    expect(result.adjusted).toBe(0);
    expect(result.data).toMatchObject({
      channel: 'whatsapp',
      outcome: 'other',
      outcomeLabel: 'Arquivado',
      interrupting: false,
    });
  });
});

import {
  API_ERROR_MESSAGES,
  type ApiErrorKind,
  failed,
  kindOfStatus,
  succeeded,
} from './api-result';

describe('kindOfStatus', () => {
  it.each<[number, ApiErrorKind]>([
    [400, 'invalid'],
    [422, 'invalid'],
    [428, 'invalid'],
    [404, 'not-found'],
    [412, 'conflict'],
    [500, 'server'],
    [503, 'server'],
    [401, 'unexpected'],
    [409, 'unexpected'],
    [302, 'unexpected'],
  ])('o status %i é o caso %s', (status, kind) => {
    expect(kindOfStatus(status)).toBe(kind);
  });
});

describe('API_ERROR_MESSAGES', () => {
  it('tem um texto de tela diferente para cada caso', () => {
    const messages = Object.values(API_ERROR_MESSAGES);

    expect(new Set(messages).size).toBe(7);
    for (const message of messages) {
      expect(message.trim()).not.toBe('');
    }
  });
});

describe('succeeded', () => {
  it('embrulha o valor num resultado de sucesso', () => {
    expect(succeeded(7)).toEqual({ ok: true, value: 7 });
  });
});

describe('failed', () => {
  it('monta o erro com o texto de tela do caso', () => {
    expect(failed({ kind: 'network' })).toEqual({
      ok: false,
      error: {
        kind: 'network',
        message:
          'Não foi possível falar com o servidor. Confira a conexão e tente de novo.',
      },
    });
  });

  it('leva o status e o problema que o servidor mandou', () => {
    const problem = { type: 'about:blank', title: 'Conflito', status: 412 };

    const result = failed({ kind: 'conflict', status: 412, problem });

    expect(result.error.status).toBe(412);
    expect(result.error.problem).toBe(problem);
    expect(result.error.message).toBe(
      'Este item foi alterado em outro lugar depois que você o abriu.',
    );
  });
});

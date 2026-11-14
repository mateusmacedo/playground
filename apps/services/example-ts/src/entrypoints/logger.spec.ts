import { afterEach, describe, expect, it, vi } from 'vitest';

import { log, withRequestId } from './logger.js';

const captureStdout = () => {
  const lines: Record<string, unknown>[] = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    lines.push(JSON.parse(String(chunk)));
    return true;
  });
  return lines;
};

// WHY: a chave precisa estar na lista de permissão; uma chave fora dela é
// redigida antes de o JSON.stringify percorrer o objeto, e nunca chegaria a
// detectar a referência circular.
const circularFields = (): Record<string, unknown> => {
  const fields: Record<string, unknown> = {};
  fields.error = fields;
  return fields;
};

describe('log', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('escreve uma linha JSON com nível, mensagem, horário e campos', () => {
    const lines = captureStdout();

    log('info', 'message_processed', { messageId: 'm1' });

    expect(lines).toEqual([
      {
        level: 'info',
        message: 'message_processed',
        time: expect.any(String),
        messageId: 'm1',
      },
    ]);
  });

  it('descarta níveis abaixo de LOG_LEVEL e usa info quando o valor é inválido', () => {
    const lines = captureStdout();

    vi.stubEnv('LOG_LEVEL', 'WARN');
    log('info', 'ignorado');
    log('warn', 'registrado');
    vi.stubEnv('LOG_LEVEL', 'verboso');
    log('debug', 'ignorado');
    log('info', 'registrado');

    expect(lines.map((line) => line.message)).toEqual([
      'registrado',
      'registrado',
    ]);
  });

  it('não deixa os campos sobrescreverem nível, mensagem e horário', () => {
    const lines = captureStdout();

    log('info', 'real', { level: 'debug', message: 'falsa', time: 'ontem' });

    expect(lines[0]).toEqual({
      level: 'info',
      message: 'real',
      time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it.each([
    ['referência circular', circularFields],
    ['BigInt', () => ({ total: 10n })],
  ])(
    'registra uma linha mínima, sem lançar, quando os campos não serializam (%s)',
    (_name, buildFields) => {
      const lines = captureStdout();
      const fields = buildFields();

      expect(() => log('error', 'message_failed', fields)).not.toThrow();

      expect(lines).toEqual([
        {
          level: 'error',
          message: 'message_failed',
          time: expect.any(String),
          serializationFailed: true,
        },
      ]);
    },
  );

  it('serializa erros com mensagem e causa', () => {
    const lines = captureStdout();

    log('error', 'message_failed', {
      error: new Error('falhou', { cause: new Error('raiz') }),
    });

    expect(lines[0]?.error).toMatchObject({
      name: 'Error',
      message: 'falhou',
      cause: { message: 'raiz' },
    });
  });

  it('acrescenta o requestId do contexto, também depois de um await', async () => {
    const lines = captureStdout();

    await withRequestId('req-1', async () => {
      log('info', 'antes');
      await Promise.resolve();
      log('info', 'depois', { requestId: 'do-call-site' });
    });
    log('info', 'fora');

    expect(lines).toMatchObject([
      { message: 'antes', requestId: 'req-1' },
      { message: 'depois', requestId: 'req-1' },
      { message: 'fora' },
    ]);
    expect(lines[2]).not.toHaveProperty('requestId');
  });

  it('não deixa token nem número de cartão chegarem ao log', () => {
    const token = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.assinatura';
    const card = '4111111111111111';
    const chunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });

    log('info', 'payment_received', {
      messageId: 'm1',
      authorization: token,
      card,
      payload: { card: Number(card), nested: [token] },
    });

    const output = chunks.join('');
    expect(output).not.toContain('eyJ');
    expect(output).not.toContain(card);
    expect(JSON.parse(output)).toMatchObject({
      messageId: 'm1',
      authorization: '[redacted]',
      card: '[redacted]',
      payload: '[redacted]',
    });
  });
});

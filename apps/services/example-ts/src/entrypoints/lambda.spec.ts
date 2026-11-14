import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sayHello } from '../core/hello.js';
import { handler } from './lambda.js';

vi.mock('../core/hello.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/hello.js')>();
  return { ...actual, sayHello: vi.fn(actual.sayHello) };
});

const event = {
  rawPath: '/example-ts',
  routeKey: 'GET /example-ts',
  requestContext: { http: { method: 'GET' } },
} as APIGatewayProxyEventV2;

const context = { awsRequestId: 'req-1' } as Context;

const captureStdout = () => {
  const lines: Record<string, unknown>[] = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    lines.push(JSON.parse(String(chunk)));
    return true;
  });
  return lines;
};

describe('entrypoint Lambda', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('traduz o evento do HTTP API em resposta JSON e resume a requisição', async () => {
    const lines = captureStdout();

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(result.body ?? '{}')).toMatchObject({
      path: '/example-ts',
    });
    expect(lines).toMatchObject([
      {
        level: 'info',
        message: 'request_completed',
        method: 'GET',
        route: 'GET /example-ts',
        status: 200,
        durationMs: expect.any(Number),
        requestId: 'req-1',
      },
    ]);
  });

  it('responde 500 genérico com o requestId e registra o erro no log', async () => {
    const lines = captureStdout();
    vi.mocked(sayHello).mockImplementationOnce(() => {
      throw new Error('falha com detalhe interno');
    });

    const result = await handler(event, context);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body ?? '{}')).toEqual({
      error: { code: 'internal', message: 'Erro interno', requestId: 'req-1' },
    });
    expect(result.body).not.toContain('detalhe interno');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      level: 'error',
      message: 'unhandled_error',
      requestId: 'req-1',
      method: 'GET',
      route: 'GET /example-ts',
      error: { message: 'falha com detalhe interno' },
    });
    expect(lines[1]).toMatchObject({
      message: 'request_completed',
      status: 500,
      requestId: 'req-1',
    });
  });
});

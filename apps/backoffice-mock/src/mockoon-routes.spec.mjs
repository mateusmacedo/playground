import { describe, expect, it } from 'vitest';

import { servesOperation } from './mockoon-routes.mjs';
import { ENVIRONMENT_PATH, readJson } from './project-files.mjs';

const environment = readJson(ENVIRONMENT_PATH);

function serves(method, path) {
  return servesOperation({ environment, operation: { method, path } });
}

describe('servesOperation', () => {
  it('atende a operação que a rota CRUD aceita e ninguém recusa', () => {
    expect(serves('get', '/boards')).toBe(true);
    expect(serves('put', '/boards/{id}')).toBe(true);
    expect(serves('delete', '/boards/{id}')).toBe(true);
  });

  it('não atende o endereço sem rota', () => {
    expect(serves('get', '/cards')).toBe(false);
  });

  it('não atende o método que a rota CRUD não tem no item', () => {
    expect(serves('post', '/boards/{id}')).toBe(false);
  });

  it('não atende o que uma resposta 405 recusa', () => {
    expect(serves('patch', '/boards/{id}')).toBe(false);
    expect(serves('delete', '/boards')).toBe(false);
    expect(serves('delete', '/process-definitions/{id}')).toBe(false);
  });

  it('atende a rota simples só no método e no endereço dela', () => {
    expect(serves('get', '/health')).toBe(true);
    expect(serves('post', '/health')).toBe(false);
    expect(serves('get', '/health/{id}')).toBe(false);
  });

  it('não toma por recusa a resposta 405 que depende de outra coisa', () => {
    const conditional = {
      routes: [
        {
          type: 'crud',
          endpoint: 'boards',
          responses: [
            {
              statusCode: 405,
              rules: [{ target: 'header', value: 'x', invert: false }],
            },
          ],
        },
      ],
    };

    expect(
      servesOperation({
        environment: conditional,
        operation: { method: 'get', path: '/boards' },
      }),
    ).toBe(true);
  });
});

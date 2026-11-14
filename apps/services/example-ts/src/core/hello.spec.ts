import { describe, expect, it } from 'vitest';

import { sayHello } from './hello.js';

describe('sayHello', () => {
  it('responde com a mensagem do serviço e o caminho recebido', () => {
    expect(sayHello({ path: '/example-ts' })).toEqual({
      message: 'Olá de example-ts',
      path: '/example-ts',
    });
  });
});

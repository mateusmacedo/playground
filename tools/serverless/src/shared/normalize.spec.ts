import { describe, expect, it } from 'vitest';

import {
  assertRelativeProjectRoot,
  normalizeProjectRoot,
  normalizeServiceName,
} from './normalize.js';

describe('normalizeServiceName', () => {
  it('aceita kebab-case e converte para minúsculas', () => {
    expect(normalizeServiceName(' Orders-API ')).toBe('orders-api');
  });

  it.each(['', 'orders_api', '-orders', 'orders-', 'orders--api', '1orders'])(
    'recusa "%s"',
    (name) => {
      expect(() => normalizeServiceName(name)).toThrow();
    },
  );
});

describe('normalizeProjectRoot', () => {
  it('normaliza separadores, prefixo ./ e barras repetidas', () => {
    expect(normalizeProjectRoot('.\\apps\\services//x/')).toBe(
      'apps/services/x',
    );
    expect(normalizeProjectRoot('.')).toBe('');
  });
});

describe('assertRelativeProjectRoot', () => {
  it.each(['', '/apps/x', 'C:/apps', 'apps/../../x'])('recusa "%s"', (root) => {
    expect(() => assertRelativeProjectRoot(root)).toThrow(/relativo/);
  });

  it('aceita caminho relativo dentro do workspace', () => {
    expect(() => assertRelativeProjectRoot('apps/services/x')).not.toThrow();
  });
});

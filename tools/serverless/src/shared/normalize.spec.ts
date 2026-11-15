import { describe, expect, it } from 'vitest';

import {
  assertRelativeProjectRoot,
  normalizeProjectRoot,
  normalizeServiceName,
  trimTrailingSlashes,
} from './normalize.js';

// WHY: uma regex com tempo quadrático leva minutos nesta entrada, e o teste
// estouraria o limite de tempo; com o laço de uma passada ele é instantâneo.
const MANY_SLASHES = '/'.repeat(200_000);

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

describe('trimTrailingSlashes', () => {
  it.each([
    ['apps/x', 'apps/x'],
    ['apps/x/', 'apps/x'],
    ['apps/x///', 'apps/x'],
    ['/apps/x', '/apps/x'],
    ['///', ''],
    ['', ''],
    ['apps/x/\n', 'apps/x/\n'],
  ])('transforma %j em %j', (value, expected) => {
    expect(trimTrailingSlashes(value)).toBe(expected);
  });

  it('termina logo com milhares de barras, no fim ou no meio do texto', () => {
    expect(trimTrailingSlashes(`apps${MANY_SLASHES}`)).toBe('apps');
    expect(trimTrailingSlashes(`apps${MANY_SLASHES}x`)).toBe(
      `apps${MANY_SLASHES}x`,
    );
    expect(trimTrailingSlashes(MANY_SLASHES)).toBe('');
  });
});

describe('normalizeProjectRoot', () => {
  it('normaliza separadores, prefixo ./ e barras repetidas', () => {
    expect(normalizeProjectRoot('.\\apps\\services//x/')).toBe(
      'apps/services/x',
    );
    expect(normalizeProjectRoot('.')).toBe('');
  });

  it('troca todas as contrabarras e tira só um prefixo ./', () => {
    expect(normalizeProjectRoot('apps\\a\\b\\')).toBe('apps/a/b');
    expect(normalizeProjectRoot('././apps')).toBe('./apps');
  });

  it('colapsa milhares de barras sem demorar', () => {
    expect(normalizeProjectRoot(`apps${MANY_SLASHES}x${MANY_SLASHES}`)).toBe(
      'apps/x',
    );
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

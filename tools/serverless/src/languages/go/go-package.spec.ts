import { describe, expect, it } from 'vitest';

import { normalizeGoPackage } from './go-package.js';

describe('normalizeGoPackage', () => {
  it.each([
    ['cmd/api', 'cmd/api'],
    ['./cmd/api', 'cmd/api'],
    ['cmd/api/', 'cmd/api'],
    ['  ./cmd/api///  ', 'cmd/api'],
    ['./', ''],
    ['.', '.'],
    ['././cmd/api', './cmd/api'],
  ])('transforma %j em %j', (value, expected) => {
    expect(normalizeGoPackage(value)).toBe(expected);
  });

  it('termina logo com milhares de barras, no fim ou no meio do texto', () => {
    // WHY: uma regex com tempo quadrático leva minutos nesta entrada, e o teste
    // estouraria o limite de tempo.
    const manySlashes = '/'.repeat(200_000);

    expect(normalizeGoPackage(`cmd/api${manySlashes}`)).toBe('cmd/api');
    expect(normalizeGoPackage(`cmd${manySlashes}api`)).toBe(
      `cmd${manySlashes}api`,
    );
  });
});

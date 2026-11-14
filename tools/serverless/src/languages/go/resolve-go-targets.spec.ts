// biome-ignore-all lint/suspicious/noTemplateCurlyInString: os specs comparam a sintaxe ${...} de variáveis do Serverless.
import { describe, expect, it } from 'vitest';

import { architectureFromManifest } from './resolve-go-targets.js';

describe('architectureFromManifest', () => {
  it.each([
    ["${env:SLS_ARCH, 'arm64'}", 'arm64'],
    ["${env:SLS_ARCH, 'x86_64'}", 'amd64'],
    ['arm64', 'arm64'],
    ['x86_64', 'amd64'],
  ])('converte %s para a arquitetura Go %s', (value, expected) => {
    expect(architectureFromManifest(value)).toBe(expected);
  });

  it('não deduz arquitetura de valores sem literal conhecido', () => {
    expect(architectureFromManifest(undefined)).toBeUndefined();
    expect(architectureFromManifest('${env:SLS_ARCH}')).toBeUndefined();
  });
});

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: os specs comparam a sintaxe ${...} de variáveis do Serverless.
import { describe, expect, it } from 'vitest';

import { defaultOptions } from '../../core/plugin-options.js';
import type { TargetContext } from '../../core/types.js';
import {
  architectureFromManifest,
  resolveGoTargets,
} from './resolve-go-targets.js';

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

describe('resolveGoTargets', () => {
  const context = (
    overrides: Partial<TargetContext['options']> = {},
  ): TargetContext => ({
    projectRoot: 'apps/services/svc',
    options: { ...defaultOptions, ...overrides },
    executorPrefix: './tools/serverless',
    pluginSourceInput: undefined,
    hostGoArch: 'amd64',
    serverlessCommand: 'serverless',
  });

  const manifest = {
    architecture: "${env:SLS_ARCH, 'arm64'}",
    goPackage: 'cmd/svc',
  };

  it('compila no floci com a arquitetura do host e nos demais com a do manifesto', () => {
    const { build } = resolveGoTargets(context(), manifest, '/inexistente');

    expect(build?.options).toEqual({
      architecture: 'arm64',
      packagePath: 'cmd/svc',
    });
    expect(build?.configurations?.floci).toEqual({ architecture: 'amd64' });
    expect(build?.configurations?.prod).toEqual({ architecture: 'arm64' });
    expect(build?.defaultConfiguration).toBe('floci');
  });

  it('usa a arquitetura padrão das opções quando o manifesto não declara uma', () => {
    const { build } = resolveGoTargets(
      context({ defaultGoArchitecture: 'amd64' }),
      { architecture: undefined, goPackage: undefined },
      '/inexistente',
    );

    expect(build?.options).toEqual({ architecture: 'amd64' });
  });

  it('não define configuration padrão quando a opção não é uma configuration', () => {
    const { build } = resolveGoTargets(
      context({ defaultConfiguration: 'qa' as 'floci' }),
      manifest,
      '/inexistente',
    );

    expect(build).not.toHaveProperty('defaultConfiguration');
  });
});

import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { defaultOptions } from './plugin-options.js';
import {
  commonServerlessTargets,
  createTargetFactory,
  PROD_DEPLOY_GUARD,
  type TargetFactory,
} from './target-builders.js';
import type { TargetContext } from './types.js';

// WHY: o spawn ignora chave com valor `undefined`, então o teste não herda
// o CI nem a liberação do ambiente em que roda.
const runGuard = (extraEnv: NodeJS.ProcessEnv) =>
  spawnSync(PROD_DEPLOY_GUARD, {
    shell: true,
    encoding: 'utf-8',
    env: {
      ...process.env,
      CI: undefined,
      NX_SERVERLESS_ALLOW_PROD_DEPLOY: undefined,
      ...extraEnv,
    },
  });

describe('PROD_DEPLOY_GUARD', () => {
  it('bloqueia o deploy fora do pipeline e diz qual é o próximo passo', () => {
    const result = runGuard({});

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Deploy em prod bloqueado pelo plugin');
    expect(result.stderr).toContain('CI=true');
    expect(result.stderr).toContain('NX_SERVERLESS_ALLOW_PROD_DEPLOY=1');
  });

  it.each([{ CI: 'true' }, { NX_SERVERLESS_ALLOW_PROD_DEPLOY: '1' }])(
    'libera o deploy com %o',
    (env) => {
      expect(runGuard(env).status).toBe(0);
    },
  );

  it.each([
    { CI: 'false' },
    { CI: '1' },
    { NX_SERVERLESS_ALLOW_PROD_DEPLOY: 'true' },
    { NX_SERVERLESS_ALLOW_PROD_DEPLOY: '' },
  ])('só aceita os valores documentados: %o continua bloqueado', (env) => {
    expect(runGuard(env).status).toBe(1);
  });
});

const PLUGIN_SOURCE_INPUT = '{workspaceRoot}/tools/serverless/src/**/*';

const context = (overrides: Partial<TargetContext> = {}): TargetContext => ({
  projectRoot: 'apps/services/svc',
  options: defaultOptions,
  executorPrefix: './tools/serverless',
  pluginSourceInput: PLUGIN_SOURCE_INPUT,
  hostGoArch: 'amd64',
  serverlessCommand: 'serverless',
  ...overrides,
});

describe('createTargetFactory', () => {
  it('lista o código do plugin como input só quando ele vive no workspace', () => {
    expect(createTargetFactory(context(), 'typescript').pluginInputs).toEqual([
      PLUGIN_SOURCE_INPUT,
    ]);
    expect(
      createTargetFactory(context({ pluginSourceInput: undefined }), 'go')
        .pluginInputs,
    ).toEqual([]);
  });

  it('descreve cada target com as tecnologias do serviço', () => {
    const target = createTargetFactory(context(), 'java').serverless(
      'package',
      ['floci'],
      'Empacota',
    );

    expect(target.metadata).toEqual({
      technologies: ['serverless', 'java'],
      description: 'Empacota',
    });
  });

  it('usa a configuration padrão só quando ela existe no target', () => {
    const factoryWith = (defaultConfiguration: 'floci' | 'prod') =>
      createTargetFactory(
        context({ options: { ...defaultOptions, defaultConfiguration } }),
        'typescript',
      );

    expect(
      factoryWith('floci').serverless('remove', ['floci', 'dev'], 'Remove')
        .defaultConfiguration,
    ).toBe('floci');
    expect(
      factoryWith('prod').serverless('remove', ['floci', 'dev'], 'Remove'),
    ).not.toHaveProperty('defaultConfiguration');
    expect(
      factoryWith('prod').validate('remove', ['floci', 'dev'], 'Valida'),
    ).not.toHaveProperty('defaultConfiguration');
  });

  it('deixa o extra do chamador sobrescrever o que o target define', () => {
    const factory = createTargetFactory(context(), 'typescript');

    expect(
      factory.serverless('deploy', ['floci'], 'Implanta', { cache: true })
        .cache,
    ).toBe(true);
    expect(
      factory.validate('deploy', ['floci'], 'Valida', { cache: true }).cache,
    ).toBe(true);
    expect(factory.serverless('deploy', ['floci'], 'Implanta').cache).toBe(
      false,
    );
  });
});

describe('commonServerlessTargets com um deploy sem configuration prod', () => {
  const factoryReturning = (
    target: ReturnType<TargetFactory['serverless']>,
  ): TargetFactory => ({
    ...createTargetFactory(context(), 'typescript'),
    serverless: () => target,
  });

  it('não envolve o deploy no guard quando falta a configuration prod', () => {
    const deploy = { command: 'x', configurations: { dev: { command: 'y' } } };

    const targets = commonServerlessTargets(
      factoryReturning(deploy),
      context(),
      [],
      [],
    );

    expect(targets.deploy).toEqual(deploy);
  });

  it('não envolve o deploy no guard quando a prod não tem comando', () => {
    const deploy = { configurations: { prod: { env: { CI: 'true' } } } };

    const targets = commonServerlessTargets(
      factoryReturning(deploy),
      context(),
      [],
      [],
    );

    expect(targets.deploy).toEqual(deploy);
  });
});

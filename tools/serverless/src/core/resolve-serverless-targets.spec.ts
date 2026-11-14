import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { defaultOptions } from './plugin-options.js';
import { resolveServerlessTargets } from './resolve-serverless-targets.js';
import { PROD_DEPLOY_GUARD } from './target-builders.js';
import type { TargetContext } from './types.js';

const PROJECT_ROOT = 'apps/services/svc';

function workspaceWith(files: Record<string, string>): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-serverless-'));
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(workspaceRoot, PROJECT_ROOT, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }
  return workspaceRoot;
}

const context = (
  overrides: Partial<TargetContext['options']> = {},
): TargetContext => ({
  projectRoot: PROJECT_ROOT,
  options: { ...defaultOptions, ...overrides },
  executorPrefix: './tools/serverless',
  pluginSourceInput: '{workspaceRoot}/tools/serverless/src/**/*',
  hostGoArch: 'amd64',
  serverlessCommand: overrides.serverlessCommand ?? 'serverless',
});

const resolve = (files: Record<string, string>, ctx = context()) =>
  resolveServerlessTargets(
    workspaceWith(files),
    `${PROJECT_ROOT}/serverless.yml`,
    ctx,
  );

const TS_MANIFEST = `service: svc
custom:
  nxServerless:
    language: typescript
provider:
  name: aws
  runtime: nodejs24.x
`;

const GO_MANIFEST = `service: svc
custom:
  nxServerless:
    language: go
provider:
  name: aws
  runtime: provided.al2023
  architecture: \${env:SLS_ARCH, 'arm64'}
`;

describe('resolveServerlessTargets para TypeScript', () => {
  const { targets, metadata } = resolve({ 'serverless.yml': TS_MANIFEST });

  it('infere só os targets do Serverless, sem build próprio', () => {
    expect(Object.keys(targets)).toEqual([
      'pre-deploy',
      'package',
      'deploy',
      'pre-remove',
      'remove',
      'invoke-local',
    ]);
    expect(metadata).toMatchObject({
      technologies: ['serverless', 'typescript'],
    });
  });

  it('torna o pre-deploy cacheável e sensível ao código do plugin', () => {
    expect(targets['pre-deploy']).toMatchObject({
      executor: './tools/serverless:validate',
      cache: true,
      defaultConfiguration: 'floci',
      inputs: ['default', '{workspaceRoot}/tools/serverless/src/**/*'],
      options: { stack: 'typescript', operation: 'deploy' },
    });
    expect(targets['pre-deploy']?.configurations?.prod).toEqual({
      stage: 'prod',
      operation: 'deploy',
    });
  });

  it('falha sem configuration e usa floci como padrão no deploy', () => {
    const deploy = targets.deploy;
    expect(deploy?.cache).toBe(false);
    expect(deploy?.defaultConfiguration).toBe('floci');
    expect(deploy?.dependsOn).toEqual(['pre-deploy']);
    expect(deploy?.command).toContain('process.exit(1)');
    expect(deploy?.options).toEqual({ cwd: PROJECT_ROOT });
    expect(deploy?.configurations?.dev).toEqual({
      command: 'serverless deploy --stage dev',
    });
  });

  it('protege o deploy em prod com o guard e deixa os outros stages livres', () => {
    const configurations = targets.deploy?.configurations ?? {};

    expect(configurations.prod?.command).toBe(
      `${PROD_DEPLOY_GUARD} && serverless deploy --stage prod`,
    );
    for (const name of ['floci', 'dev', 'homolog']) {
      expect(configurations[name]?.command).not.toContain('node -e');
    }
    expect(targets.package?.configurations?.prod?.command).toBe(
      'serverless package --stage prod',
    );
  });

  it('não oferece remove em prod e não repassa argumentos ao comando', () => {
    expect(Object.keys(targets.remove?.configurations ?? {})).toEqual([
      'floci',
      'dev',
      'homolog',
    ]);
    expect(targets.remove?.options).toMatchObject({ forwardAllArgs: false });
    expect(targets.remove?.dependsOn).toEqual(['pre-remove']);
    expect(targets['pre-remove']?.options).toMatchObject({
      operation: 'remove',
    });
  });

  it('aplica nomes de target e comando do Serverless vindos das opções', () => {
    const custom = resolve(
      { 'serverless.yml': TS_MANIFEST },
      context({
        deployTargetName: 'ship',
        validateTargetName: 'check',
        serverlessCommand: 'pnpm exec serverless',
      }),
    ).targets;

    expect(custom.ship?.dependsOn).toEqual(['check']);
    expect(custom.ship?.configurations?.floci).toMatchObject({
      command: 'pnpm exec serverless deploy --stage local',
    });
  });
});

describe('resolveServerlessTargets para Go', () => {
  const { targets } = resolve({
    'serverless.yml': GO_MANIFEST,
    'go.mod': 'module svc\n',
    'cmd/svc/main.go': 'package main\n',
  });

  it('infere test, lint e build além dos targets do Serverless', () => {
    expect(Object.keys(targets)).toEqual([
      'test',
      'lint',
      'build',
      'pre-deploy',
      'package',
      'deploy',
      'pre-remove',
      'remove',
      'invoke-local',
    ]);
  });

  it('faz o lint com gofmt e go vet, em cache e sem configuration', () => {
    expect(targets.lint).toMatchObject({
      command: 'bash ../../../tools/go-fmt-check.sh && go vet ./...',
      options: { cwd: PROJECT_ROOT },
      cache: true,
      inputs: [
        '{projectRoot}/**/*.go',
        '{projectRoot}/go.mod',
        '{projectRoot}/go.sum',
        { runtime: 'go version' },
        '{workspaceRoot}/tools/go-fmt-check.sh',
      ],
    });
    expect(targets.lint?.command).toContain('go vet ./...');
    expect(targets.lint?.configurations).toBeUndefined();
    expect(targets.lint?.defaultConfiguration).toBeUndefined();
  });

  it('compila para o host no Floci e para a arquitetura do manifesto nos demais stages', () => {
    expect(targets.build).toMatchObject({
      executor: './tools/serverless:go-build',
      options: { architecture: 'arm64', packagePath: 'cmd/svc' },
      defaultConfiguration: 'floci',
      cache: true,
      outputs: ['{projectRoot}/.bin'],
    });
    expect(targets.build?.configurations).toEqual({
      floci: { architecture: 'amd64' },
      dev: { architecture: 'arm64' },
      homolog: { architecture: 'arm64' },
      prod: { architecture: 'arm64' },
    });
  });

  it('garante o artefato antes de validar, empacotar, implantar e invocar', () => {
    expect(targets['pre-deploy']?.dependsOn).toEqual(['build']);
    expect(targets.deploy?.dependsOn).toEqual(['pre-deploy', 'build']);
    expect(targets.package?.dependsOn).toEqual(['pre-deploy', 'build']);
    expect(targets['invoke-local']?.dependsOn).toEqual(['build']);
  });
});

describe('detecção de linguagem', () => {
  it('usa o sistema de arquivos quando o manifesto não declara a linguagem', () => {
    const { metadata } = resolve({
      'serverless.yml': 'service: svc\nprovider:\n  name: aws\n',
      'go.mod': 'module svc\n',
    });
    expect(metadata).toMatchObject({ technologies: ['serverless', 'go'] });
  });

  it('exige custom.nxServerless.language quando a linguagem é ambígua', () => {
    expect(() =>
      resolve({
        'serverless.yml': 'service: svc\n',
        'go.mod': 'module svc\n',
        'tsconfig.json': '{}',
      }),
    ).toThrow(/custom\.nxServerless\.language/);
  });
});

describe('pacote Go do build', () => {
  const goManifest = (extra = '') => `service: svc
custom:
  nxServerless:
    language: go
${extra}provider:
  name: aws
  runtime: provided.al2023
`;
  const buildOptions = (files: Record<string, string>) =>
    resolve({ 'go.mod': 'module svc\n', ...files }).targets.build?.options;

  it('usa o goPackage declarado no manifesto', () => {
    expect(
      buildOptions({
        'serverless.yml': goManifest('    goPackage: ./cmd/api/\n'),
        'cmd/api/main.go': '',
        'cmd/worker/main.go': '',
      }),
    ).toMatchObject({ packagePath: 'cmd/api' });
  });

  it('detecta um único cmd/*/main.go e compila a raiz quando há main.go nela', () => {
    expect(
      buildOptions({
        'serverless.yml': goManifest(),
        'cmd/api/main.go': '',
      }),
    ).toMatchObject({ packagePath: 'cmd/api' });
    expect(
      buildOptions({ 'serverless.yml': goManifest(), 'main.go': '' }),
    ).not.toHaveProperty('packagePath');
  });

  it('não escolhe pacote quando há vários cmd sem declaração', () => {
    expect(
      buildOptions({
        'serverless.yml': goManifest(),
        'cmd/api/main.go': '',
        'cmd/worker/main.go': '',
      }),
    ).not.toHaveProperty('packagePath');
  });
});

describe('resolveServerlessTargets para Java (Quarkus com Gradle)', () => {
  const javaManifest = (extra = '') => `service: svc
custom:
  nxServerless:
    language: java
${extra}provider:
  name: aws
  runtime: \${param:runtime}
`;

  const { targets, metadata } = resolve({
    'serverless.yml': javaManifest(),
    'build.gradle.kts': 'plugins { id("io.quarkus") }\n',
  });

  it('infere o build pelo Gradle e deixa o test para o @nx/gradle', () => {
    expect(Object.keys(targets)).toEqual([
      'build',
      'pre-deploy',
      'package',
      'deploy',
      'pre-remove',
      'remove',
      'invoke-local',
    ]);
    expect(metadata).toMatchObject({ technologies: ['serverless', 'java'] });
    expect(targets.test).toBeUndefined();
  });

  it('compila em JVM no Floci e nativo nos stages da AWS, a partir da raiz', () => {
    const jvm = './gradlew :apps:services:svc:quarkusBuild --console=plain';
    const native = `${jvm} -Dquarkus.native.enabled=true -Dquarkus.native.container-build=true -Dquarkus.package.jar.enabled=false`;

    expect(targets.build).toMatchObject({
      command: jvm,
      defaultConfiguration: 'floci',
      cache: true,
      outputs: ['{projectRoot}/build'],
    });
    expect(targets.build?.options).toBeUndefined();
    expect(targets.build?.configurations).toEqual({
      floci: { command: jvm },
      dev: { command: native },
      homolog: { command: native },
      prod: { command: native },
    });
    expect(targets.deploy?.dependsOn).toEqual(['pre-deploy', 'build']);
    expect(targets['pre-deploy']?.options).toMatchObject({ stack: 'java' });
  });

  it('usa o projeto Gradle e o comando declarados', () => {
    const custom = resolve(
      {
        'serverless.yml': javaManifest('    gradleProject: example-quarkus\n'),
      },
      context({ gradleCommand: 'gradle' }),
    ).targets;

    expect(custom.build?.command).toBe(
      'gradle :example-quarkus:quarkusBuild --console=plain',
    );
    expect(custom.build?.inputs).toContain('^production');
  });

  it('detecta Quarkus pelo build.gradle quando o manifesto não declara a linguagem', () => {
    const detected = resolve({
      'serverless.yml': 'service: svc\nprovider:\n  name: aws\n',
      'build.gradle': "plugins { id 'io.quarkus' }\n",
    });
    expect(detected.metadata).toMatchObject({
      technologies: ['serverless', 'java'],
    });

    expect(() =>
      resolve({
        'serverless.yml': 'service: svc\n',
        'build.gradle.kts': 'plugins { java }\n',
      }),
    ).toThrow(/build\.gradle/);
  });
});

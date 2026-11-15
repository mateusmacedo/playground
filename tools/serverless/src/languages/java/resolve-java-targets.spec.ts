import { describe, expect, it } from 'vitest';

import { defaultOptions } from '../../core/plugin-options.js';
import type { TargetContext } from '../../core/types.js';
import { QUARKUS_NATIVE_FLAGS } from '../../shared/constants.js';
import {
  gradleProjectPath,
  resolveJavaTargets,
} from './resolve-java-targets.js';

const context = (
  overrides: Partial<TargetContext['options']> = {},
): TargetContext => ({
  projectRoot: 'apps/services/svc',
  options: { ...defaultOptions, ...overrides },
  executorPrefix: './tools/serverless',
  pluginSourceInput: '{workspaceRoot}/tools/serverless/src/**/*',
  hostGoArch: 'amd64',
  serverlessCommand: 'serverless',
});

describe('gradleProjectPath', () => {
  it.each([
    [':apps:svc', ':apps:svc'],
    ['apps:svc', ':apps:svc'],
  ])('normaliza o projeto declarado %s para %s', (declared, expected) => {
    expect(gradleProjectPath('apps/services/svc', declared)).toBe(expected);
  });

  it('deriva o caminho Gradle da pasta do projeto quando não há declaração', () => {
    expect(gradleProjectPath('apps/services/svc/', undefined)).toBe(
      ':apps:services:svc',
    );
  });
});

describe('resolveJavaTargets', () => {
  const resolve = (
    overrides: Partial<TargetContext['options']> = {},
    gradleProject?: string,
  ) => resolveJavaTargets(context(overrides), { gradleProject });

  it('compila em JVM no floci e em nativo nos stages da AWS', () => {
    const { build } = resolve({}, ':apps:svc');

    expect(build?.command).toBe(
      './gradlew :apps:svc:quarkusBuild --console=plain',
    );
    expect(build?.configurations?.floci?.command).toBe(
      './gradlew :apps:svc:quarkusBuild --console=plain',
    );
    for (const stage of ['dev', 'homolog', 'prod']) {
      expect(build?.configurations?.[stage]?.command).toBe(
        `./gradlew :apps:svc:quarkusBuild --console=plain ${QUARKUS_NATIVE_FLAGS}`,
      );
    }
    expect(build?.defaultConfiguration).toBe('floci');
  });

  it('usa o comando do Gradle e o nome de target informados nas opções', () => {
    const targets = resolve({
      gradleCommand: 'gradle',
      buildTargetName: 'assemble',
    });

    expect(targets.assemble?.command).toBe(
      'gradle :apps:services:svc:quarkusBuild --console=plain',
    );
    expect(targets).not.toHaveProperty('build');
  });

  it('inclui o código do plugin nos inputs do build quando ele vive no workspace', () => {
    expect(resolve().build?.inputs).toContain(
      '{workspaceRoot}/tools/serverless/src/**/*',
    );
  });

  it('não define configuration padrão quando a opção não é uma configuration', () => {
    const targets = resolve({ defaultConfiguration: 'qa' as 'floci' });

    expect(targets.build).not.toHaveProperty('defaultConfiguration');
  });
});

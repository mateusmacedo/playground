import type { TargetConfiguration } from '@nx/devkit';

import { pickDefaultConfiguration } from '../../core/stage-configurations.js';
import {
  commonServerlessTargets,
  createTargetFactory,
  DEPLOY_CONFIGURATIONS,
} from '../../core/target-builders.js';
import type { ServerlessManifest, TargetContext } from '../../core/types.js';
import { QUARKUS_NATIVE_FLAGS } from '../../shared/constants.js';

const GRADLE_INPUTS = [
  '{projectRoot}/**/build.gradle.kts',
  '{projectRoot}/**/build.gradle',
  '{projectRoot}/gradle.properties',
  '{workspaceRoot}/settings.gradle.kts',
  '{workspaceRoot}/settings.gradle',
  '{workspaceRoot}/build.gradle.kts',
  '{workspaceRoot}/build.gradle',
  '{workspaceRoot}/gradle.properties',
  '{workspaceRoot}/gradle/**/*',
  { runtime: 'java -version 2>&1' },
];

export function gradleProjectPath(
  projectRoot: string,
  declared: string | undefined,
): string {
  if (declared) {
    return declared.startsWith(':') ? declared : `:${declared}`;
  }
  return `:${projectRoot.split('/').filter(Boolean).join(':')}`;
}

export function resolveJavaTargets(
  ctx: TargetContext,
  manifest: Pick<ServerlessManifest, 'gradleProject'>,
): Record<string, TargetConfiguration> {
  const factory = createTargetFactory(ctx, 'java');
  const { buildTargetName, gradleCommand } = ctx.options;
  const project = gradleProjectPath(ctx.projectRoot, manifest.gradleProject);

  // WHY: `quarkusBuild` gera o build/function.zip sem passar pelo `check`
  // (testes e spotless), que têm targets próprios inferidos pelo @nx/gradle.
  const jvmBuild = `${gradleCommand} ${project}:quarkusBuild --console=plain`;
  const nativeBuild = `${jvmBuild} ${QUARKUS_NATIVE_FLAGS}`;
  const defaultConfiguration = pickDefaultConfiguration(
    DEPLOY_CONFIGURATIONS,
    ctx.options.defaultConfiguration,
  );

  // WHY: no Floci vale o build JVM, rápido para o ciclo de dev; os stages da
  // AWS recebem o nativo. Como no Go, o build tem a mesma defaultConfiguration
  // do deploy, porque o Nx só repassa às dependências a configuration digitada.
  const buildConfigurations = Object.fromEntries(
    DEPLOY_CONFIGURATIONS.map((name) => [
      name,
      { command: name === 'floci' ? jvmBuild : nativeBuild },
    ]),
  );

  // WHY: sem target `test` aqui: o @nx/gradle já infere `test` na mesma raiz
  // e o plugin, registrado depois, sobrescreveria o dele.
  return {
    [buildTargetName]: factory.withMetadata(
      {
        command: jvmBuild,
        configurations: buildConfigurations,
        ...(defaultConfiguration ? { defaultConfiguration } : {}),
        cache: true,
        // WHY: `^production` cobre os projetos Gradle aninhados (por exemplo o
        // core), que o Nx atribui a outro projeto e o @nx/gradle liga como
        // dependência; sem ele, mudar o core deixaria o zip em cache velho.
        inputs: [
          '{projectRoot}/src/main/**/*',
          '^production',
          ...GRADLE_INPUTS,
          ...factory.pluginInputs,
        ],
        outputs: ['{projectRoot}/build'],
      },
      'Compila pelo Gradle: JVM no Floci, nativo nos stages da AWS',
    ),
    ...commonServerlessTargets(
      factory,
      ctx,
      [buildTargetName],
      [buildTargetName],
    ),
  };
}

import type { TargetConfiguration } from '@nx/devkit';

import { STAGE_CONFIGURATION_NAMES } from '../shared/constants.js';
import type {
  ServerlessOperation,
  Stack,
  StageConfigurationName,
} from '../shared/types.js';
import {
  buildCommandConfigurations,
  buildValidateConfigurations,
  pickDefaultConfiguration,
  stageDefinitions,
} from './stage-configurations.js';
import type { TargetContext } from './types.js';

export const DEPLOY_CONFIGURATIONS = STAGE_CONFIGURATION_NAMES;

// WHY: remover a stack de prod fica fora do plugin; a ausência da
// configuration é a primeira barreira e o executor validate é a segunda.
export const REMOVE_CONFIGURATIONS: readonly StageConfigurationName[] = [
  'floci',
  'dev',
  'homolog',
];

export const INVOKE_CONFIGURATIONS: readonly StageConfigurationName[] = [
  'floci',
  'dev',
  'homolog',
];

// WHY: sem configuration o comando rodaria contra um stage implícito na conta
// real; exigir a configuration evita deploy acidental.
export const missingConfigurationGuard = (
  names: readonly StageConfigurationName[],
): string =>
  `node -e "console.error('Informe uma configuration: ${names.join(', ')} (ex.: -c ${names[0]}).'); process.exit(1)"`;

// WHY: deploy em prod a partir de um terminal local pula a revisão e o
// pipeline. O guard vai dentro do comando da configuration `prod` (e o deploy
// não é cacheado), então lê o ambiente na hora do deploy; guardar no
// `pre-deploy` não serviria, porque ele é cacheado e o `package` também o usa.
// NOTE: sem `!` e sem aspas simples na mensagem, para sobreviver ao shell.
export const PROD_DEPLOY_GUARD = `node -e "const ci = process.env.CI === 'true'; const allowed = process.env.NX_SERVERLESS_ALLOW_PROD_DEPLOY === '1'; if (ci || allowed) process.exit(0); console.error('Deploy em prod bloqueado pelo plugin: rode pelo pipeline (CI=true) ou, em emergência, exporte NX_SERVERLESS_ALLOW_PROD_DEPLOY=1 e repita o comando.'); process.exit(1)"`;

const guardProdDeploy = (target: TargetConfiguration): TargetConfiguration => {
  const prod = target.configurations?.prod;
  if (!prod?.command) {
    return target;
  }
  return {
    ...target,
    configurations: {
      ...target.configurations,
      prod: { ...prod, command: `${PROD_DEPLOY_GUARD} && ${prod.command}` },
    },
  };
};

export type TargetFactory = {
  pluginInputs: string[];
  withMetadata: (
    target: TargetConfiguration,
    description: string,
  ) => TargetConfiguration;
  serverless: (
    subcommand: string,
    names: readonly StageConfigurationName[],
    description: string,
    extra?: Partial<TargetConfiguration>,
  ) => TargetConfiguration;
  validate: (
    operation: ServerlessOperation,
    names: readonly StageConfigurationName[],
    description: string,
    extra?: Partial<TargetConfiguration>,
  ) => TargetConfiguration;
};

export function createTargetFactory(
  ctx: TargetContext,
  stack: Stack,
): TargetFactory {
  const definitions = stageDefinitions(ctx.options, ctx.hostGoArch);
  const technologies = ['serverless', stack];

  const withMetadata = (
    target: TargetConfiguration,
    description: string,
  ): TargetConfiguration => ({
    ...target,
    metadata: { technologies, description },
  });

  const defaultFor = (names: readonly StageConfigurationName[]) => {
    const name = pickDefaultConfiguration(
      names,
      ctx.options.defaultConfiguration,
    );
    return name ? { defaultConfiguration: name } : {};
  };

  return {
    pluginInputs: ctx.pluginSourceInput ? [ctx.pluginSourceInput] : [],
    withMetadata,
    serverless: (subcommand, names, description, extra = {}) =>
      withMetadata(
        {
          command: missingConfigurationGuard(names),
          options: { cwd: ctx.projectRoot },
          configurations: buildCommandConfigurations(
            `${ctx.serverlessCommand} ${subcommand}`,
            names,
            definitions,
          ),
          ...defaultFor(names),
          cache: false,
          ...extra,
        },
        description,
      ),
    validate: (operation, names, description, extra = {}) =>
      withMetadata(
        {
          executor: `${ctx.executorPrefix}:validate`,
          options: { stack, operation },
          configurations: buildValidateConfigurations(
            names,
            definitions,
            operation,
          ),
          ...defaultFor(names),
          ...extra,
        },
        description,
      ),
  };
}

export function commonServerlessTargets(
  factory: TargetFactory,
  ctx: TargetContext,
  preDeployDependsOn: string[],
  artifactDependsOn: string[],
): Record<string, TargetConfiguration> {
  const { options } = ctx;
  const preRemoveTargetName = `pre-${options.removeTargetName}`;
  const deployDependsOn = [options.validateTargetName, ...artifactDependsOn];

  return {
    [options.validateTargetName]: factory.validate(
      'deploy',
      DEPLOY_CONFIGURATIONS,
      'Valida o serverless.yml contra as políticas do monorepo',
      {
        cache: true,
        inputs: ['default', ...factory.pluginInputs],
        ...(preDeployDependsOn.length > 0
          ? { dependsOn: preDeployDependsOn }
          : {}),
      },
    ),
    [options.packageTargetName]: factory.serverless(
      'package',
      DEPLOY_CONFIGURATIONS,
      'Empacota o serviço com o Serverless Framework',
      { dependsOn: deployDependsOn, outputs: ['{projectRoot}/.serverless'] },
    ),
    [options.deployTargetName]: guardProdDeploy(
      factory.serverless(
        'deploy',
        DEPLOY_CONFIGURATIONS,
        'Implanta o serviço no stage da configuration',
        { dependsOn: deployDependsOn },
      ),
    ),
    [preRemoveTargetName]: factory.validate(
      'remove',
      REMOVE_CONFIGURATIONS,
      'Valida a remoção da stack (bloqueada em prod)',
      { cache: false },
    ),
    [options.removeTargetName]: factory.serverless(
      'remove',
      REMOVE_CONFIGURATIONS,
      'Remove a stack do stage da configuration',
      {
        dependsOn: [preRemoveTargetName],
        // WHY: impede que um `--stage` repassado na linha de comando
        // sobrescreva o stage que o pre-remove validou.
        options: { cwd: ctx.projectRoot, forwardAllArgs: false },
      },
    ),
    [options.invokeLocalTargetName]: factory.serverless(
      'invoke local',
      INVOKE_CONFIGURATIONS,
      'Executa uma função localmente (use --function=<nome>)',
      artifactDependsOn.length > 0 ? { dependsOn: artifactDependsOn } : {},
    ),
  };
}

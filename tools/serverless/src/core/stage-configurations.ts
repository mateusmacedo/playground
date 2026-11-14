import { arch } from 'node:os';

import { GO_TO_AWS_ARCH } from '../shared/constants.js';
import type {
  GoArch,
  ServerlessOperation,
  ServerlessStage,
  StageConfigurationName,
} from '../shared/types.js';
import type { NormalizedPluginOptions } from './types.js';

export type StageDefinition = {
  stage: ServerlessStage;
  env?: Record<string, string>;
};

export type CommandConfiguration = {
  command: string;
  env?: Record<string, string>;
};

export type ValidateConfiguration = {
  stage: ServerlessStage;
  operation: ServerlessOperation;
};

export const detectHostGoArch = (): GoArch =>
  arch() === 'arm64' ? 'arm64' : 'amd64';

// WHY: o Floci executa as Lambdas em containers no próprio host, então o
// artefato precisa ter a arquitetura da máquina, não a de produção (arm64).
export function stageDefinitions(
  options: NormalizedPluginOptions,
  hostGoArch: GoArch,
): Record<StageConfigurationName, StageDefinition> {
  return {
    floci: {
      stage: 'local',
      env: {
        AWS_ENDPOINT_URL: options.flociEndpoint,
        AWS_REGION: options.flociRegion,
        AWS_DEFAULT_REGION: options.flociRegion,
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
        SLS_ARCH: GO_TO_AWS_ARCH[hostGoArch],
      },
    },
    dev: { stage: 'dev' },
    homolog: { stage: 'homolog' },
    prod: { stage: 'prod' },
  };
}

export function buildCommandConfigurations(
  baseCommand: string,
  names: readonly StageConfigurationName[],
  definitions: Record<StageConfigurationName, StageDefinition>,
): Record<string, CommandConfiguration> {
  return Object.fromEntries(
    names.map((name) => {
      const { stage, env } = definitions[name];
      const configuration: CommandConfiguration = {
        command: `${baseCommand} --stage ${stage}`,
      };
      if (env) {
        configuration.env = { ...env };
      }
      return [name, configuration];
    }),
  );
}

export function buildValidateConfigurations(
  names: readonly StageConfigurationName[],
  definitions: Record<StageConfigurationName, StageDefinition>,
  operation: ServerlessOperation,
): Record<string, ValidateConfiguration> {
  return Object.fromEntries(
    names.map((name) => [name, { stage: definitions[name].stage, operation }]),
  );
}

export function pickDefaultConfiguration(
  names: readonly StageConfigurationName[],
  preferred: StageConfigurationName,
): StageConfigurationName | undefined {
  return names.includes(preferred) ? preferred : undefined;
}

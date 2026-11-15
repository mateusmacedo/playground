import { describe, expect, it } from 'vitest';

import { defaultOptions } from './plugin-options.js';
import {
  buildCommandConfigurations,
  buildValidateConfigurations,
  pickDefaultConfiguration,
  stageDefinitions,
} from './stage-configurations.js';

describe('stageDefinitions', () => {
  it('injeta endpoint, credenciais test e arquitetura do host só na configuration floci', () => {
    const definitions = stageDefinitions(defaultOptions, 'amd64');

    expect(definitions.floci).toEqual({
      stage: 'local',
      env: {
        AWS_ENDPOINT_URL: 'http://localhost:4566',
        AWS_REGION: 'us-east-1',
        AWS_DEFAULT_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
        SLS_ARCH: 'x86_64',
      },
    });
    expect(definitions.dev).toEqual({ stage: 'dev' });
    expect(definitions.homolog).toEqual({ stage: 'homolog' });
    expect(definitions.prod).toEqual({ stage: 'prod' });
  });

  it('respeita endpoint e região informados nas opções do plugin', () => {
    const definitions = stageDefinitions(
      {
        ...defaultOptions,
        flociEndpoint: 'http://floci:4566',
        flociRegion: 'sa-east-1',
      },
      'arm64',
    );

    expect(definitions.floci.env).toMatchObject({
      AWS_ENDPOINT_URL: 'http://floci:4566',
      AWS_REGION: 'sa-east-1',
      SLS_ARCH: 'arm64',
    });
  });
});

describe('buildCommandConfigurations', () => {
  it('monta o comando com o stage e só leva env quando a definição tem', () => {
    const definitions = stageDefinitions(defaultOptions, 'amd64');

    const configurations = buildCommandConfigurations(
      'serverless deploy',
      ['floci', 'prod'],
      definitions,
    );

    expect(configurations.floci?.command).toBe(
      'serverless deploy --stage local',
    );
    expect(configurations.floci?.env?.AWS_ENDPOINT_URL).toBe(
      'http://localhost:4566',
    );
    expect(configurations.prod).toEqual({
      command: 'serverless deploy --stage prod',
    });
  });
});

describe('buildValidateConfigurations', () => {
  it('associa cada configuration ao stage e à operação', () => {
    const definitions = stageDefinitions(defaultOptions, 'amd64');

    expect(
      buildValidateConfigurations(['floci', 'homolog'], definitions, 'remove'),
    ).toEqual({
      floci: { stage: 'local', operation: 'remove' },
      homolog: { stage: 'homolog', operation: 'remove' },
    });
  });
});

describe('pickDefaultConfiguration', () => {
  it('só usa a preferida quando ela existe no target', () => {
    expect(pickDefaultConfiguration(['floci', 'dev'], 'floci')).toBe('floci');
    expect(pickDefaultConfiguration(['floci', 'dev'], 'prod')).toBeUndefined();
  });
});

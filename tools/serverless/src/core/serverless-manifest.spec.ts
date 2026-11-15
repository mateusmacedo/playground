import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseServerlessManifest,
  readServerlessManifest,
} from './serverless-manifest.js';

describe('parseServerlessManifest', () => {
  it('extrai serviço, provider e a configuração do plugin', () => {
    const manifest = parseServerlessManifest(`service: svc
provider:
  name: aws
  runtime: nodejs24.x
  architecture: arm64
custom:
  nxServerless:
    language: Go
    goPackage: cmd/svc
    gradleProject: ':apps:svc'
`);

    expect(manifest).toMatchObject({
      service: 'svc',
      providerName: 'aws',
      runtime: 'nodejs24.x',
      architecture: 'arm64',
      language: 'go',
      goPackage: 'cmd/svc',
      gradleProject: ':apps:svc',
    });
  });

  it('junta os artefatos do serviço e das funções sem repetir', () => {
    const manifest = parseServerlessManifest(`service: svc
package:
  artifact: build/service.zip
functions:
  api:
    handler: x
    package:
      artifact: build/api.zip
  worker:
    handler: y
    package:
      artifact: build/api.zip
  sem-artefato:
    handler: z
`);

    expect(manifest.artifacts).toEqual(['build/service.zip', 'build/api.zip']);
  });

  it('só guarda os params que são mapas', () => {
    const manifest = parseServerlessManifest(`service: svc
params:
  local:
    runtime: java21
  default:
    runtime: provided.al2023
  invalido: texto
`);

    expect(manifest.params).toEqual({
      local: { runtime: 'java21' },
      default: { runtime: 'provided.al2023' },
    });
  });

  it('devolve o manifesto vazio quando o YAML é inválido', () => {
    const manifest = parseServerlessManifest('service: [aberto');

    expect(manifest.parsed).toBeNull();
    expect(manifest.service).toBeUndefined();
    expect(manifest.artifacts).toEqual([]);
    expect(manifest.params).toEqual({});
  });
});

describe('readServerlessManifest', () => {
  it('lê o serverless.yml a partir da raiz do workspace', () => {
    const workspaceRoot = mkdtempSync(
      join(tmpdir(), 'nx-serverless-manifest-'),
    );
    mkdirSync(join(workspaceRoot, 'apps/svc'), { recursive: true });
    writeFileSync(
      join(workspaceRoot, 'apps/svc/serverless.yml'),
      'service: lido-do-disco\n',
    );

    expect(
      readServerlessManifest(workspaceRoot, 'apps/svc/serverless.yml').service,
    ).toBe('lido-do-disco');
  });
});

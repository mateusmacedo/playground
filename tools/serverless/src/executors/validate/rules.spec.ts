// biome-ignore-all lint/suspicious/noTemplateCurlyInString: os specs comparam a sintaxe ${...} de variáveis do Serverless.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseServerlessManifest } from '../../core/serverless-manifest.js';
import type { ServerlessOperation, Stack } from '../../shared/types.js';
import { validateServerlessProject } from './rules.js';

function projectWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'nx-serverless-validate-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const manifest = (runtime: string, extra = '') =>
  parseServerlessManifest(`service: my-service
custom:
  nxServerless:
    type: http
provider:
  name: aws
  runtime: ${runtime}
${extra}`);

type Case = {
  stack?: Stack;
  operation?: ServerlessOperation;
  stage?: string;
  runtime?: string;
  raw?: string;
  files?: Record<string, string>;
};

const TS_FILES = { 'package.json': '{}', 'tsconfig.json': '{}' };
const GO_FILES = {
  'go.mod': 'module x\n',
  'main.go': 'package main\n',
  '.bin/bootstrap.zip': 'zip',
};

function validate({
  stack = 'typescript',
  operation = 'deploy',
  stage = 'local',
  runtime = stack === 'typescript' ? 'nodejs24.x' : 'provided.al2023',
  raw,
  files,
}: Case) {
  const defaultFiles = stack === 'typescript' ? TS_FILES : GO_FILES;
  return validateServerlessProject({
    manifest:
      raw === undefined ? manifest(runtime) : parseServerlessManifest(raw),
    stack,
    operation,
    stage,
    absProjectRoot: projectWith(files ?? defaultFiles),
    projectRoot: 'apps/services/my-service',
  });
}

describe('validateServerlessProject', () => {
  it('aprova um serviço TypeScript e um Go válidos', () => {
    expect(validate({}).errors).toEqual([]);
    expect(validate({ stack: 'go' }).errors).toEqual([]);
  });

  it.each(['local', 'dev', 'homolog', 'prod'])(
    'aceita o stage %s para deploy',
    (stage) => {
      expect(validate({ stage }).errors).toEqual([]);
    },
  );

  it('recusa stage fora da allowlist e stage ausente em deploy', () => {
    expect(validate({ stage: 'staging' }).errors).toEqual([
      'Stage "staging" não permitido. Stages válidos: local, dev, homolog, prod.',
    ]);
    expect(validate({ stage: '' }).errors).toEqual([
      'O stage é obrigatório para a operação "deploy".',
    ]);
  });

  it('bloqueia remove em prod mesmo com o manifesto válido', () => {
    expect(validate({ operation: 'remove', stage: 'PROD' }).errors).toEqual([
      'Remoção em "prod" bloqueada pelo plugin; siga o runbook de descomissionamento.',
    ]);
    expect(validate({ operation: 'remove', stage: 'dev' }).errors).toEqual([]);
  });

  it('exige custom.nxServerless, provider aws e nome em kebab-case', () => {
    const { errors } = validate({
      raw: 'service: MyService\nprovider:\n  name: azure\n  runtime: nodejs24.x\n',
    });
    expect(errors).toEqual([
      'O manifesto precisa declarar "custom.nxServerless".',
      'provider.name deve ser "aws", recebido "azure".',
      'O nome do serviço "MyService" deve ser kebab-case.',
    ]);
  });

  it('recusa extends e linguagem declarada diferente da inferida', () => {
    const { errors } = validate({
      raw: `service: s
extends: ./base.yml
custom:
  nxServerless:
    language: go
provider:
  name: aws
  runtime: nodejs24.x
`,
    });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('"extends"');
    expect(errors[1]).toContain('"go"');
  });

  it('exige runtime nodejs* e os arquivos do projeto TypeScript', () => {
    expect(validate({ files: {} }).errors).toEqual([
      'Falta package.json na raiz do projeto.',
      'Falta tsconfig.json na raiz do projeto.',
    ]);
    expect(validate({ runtime: 'python3.12' }).errors).toEqual([
      'O runtime TypeScript deve começar com "nodejs", recebido "python3.12".',
    ]);
  });

  it('exige o bootstrap.zip para deploy e package de Go, mas não para remove', () => {
    const files = { 'go.mod': 'module x\n', 'main.go': '' };
    const missingArtifact =
      'Artefato .bin/bootstrap.zip não encontrado; rode o target de build antes de "package".';

    expect(
      validate({ stack: 'go', operation: 'package', files }).errors,
    ).toEqual([missingArtifact]);
    expect(
      validate({ stack: 'go', operation: 'remove', files }).errors,
    ).toEqual([]);
  });

  it('exige provided.al2023 e avisa quando não há main.go', () => {
    expect(
      validate({
        stack: 'go',
        runtime: 'go1.x',
        operation: 'remove',
        files: { 'go.mod': 'module x\n' },
      }),
    ).toEqual({
      errors: ['O runtime Go deve ser "provided.al2023", recebido "go1.x".'],
      warnings: ['Nenhum main.go encontrado na raiz nem em cmd/*/.'],
    });
  });

  it('exige o main.go do goPackage declarado', () => {
    const raw = `service: s
custom:
  nxServerless:
    goPackage: cmd/api
provider:
  name: aws
  runtime: provided.al2023
`;
    expect(
      validate({
        stack: 'go',
        raw,
        files: { ...GO_FILES, 'cmd/api/main.go': '' },
      }).errors,
    ).toEqual([]);
    expect(validate({ stack: 'go', raw, files: GO_FILES }).errors).toEqual([
      'custom.nxServerless.goPackage aponta para "cmd/api", mas cmd/api/main.go não existe.',
    ]);
  });

  it('dispensa o zip quando todas as funções usam imagem de container', () => {
    const { errors } = validate({
      stack: 'go',
      raw: `service: s
custom:
  nxServerless: {}
provider:
  name: aws
  runtime: provided.al2023
functions:
  api:
    image: repo/app:latest
`,
      files: { 'go.mod': 'module x\n', 'cmd/api/main.go': '' },
    });
    expect(errors).toEqual([]);
  });

  it('aceita tags do CloudFormation e recusa YAML inválido', () => {
    expect(validate({ raw: TS_MANIFEST_WITH_TAGS }).errors).toEqual([]);
    expect(validate({ raw: 'service: [' }).errors).toEqual([
      'O serverless.yml não é um YAML válido.',
    ]);
  });
});

const TS_MANIFEST_WITH_TAGS = `service: s
custom:
  nxServerless: {}
provider:
  name: aws
  runtime: nodejs24.x
resources:
  Outputs:
    QueueArn:
      Value: !GetAtt Queue.Arn
`;

describe('validateServerlessProject para Java', () => {
  const javaManifest = (artifact = 'build/function.zip') => `service: svc
custom:
  nxServerless:
    language: java
params:
  local:
    runtime: java21
  default:
    runtime: provided.al2023
provider:
  name: aws
  runtime: \${param:runtime}
functions:
  api:
    handler: x
    package:
      artifact: ${artifact}
`;
  const JAVA_FILES = {
    'build.gradle.kts': 'plugins { id("io.quarkus") }',
    'build/function.zip': 'zip',
  };

  const validateJava = (overrides: Partial<Case> = {}) =>
    validate({
      stack: 'java',
      raw: javaManifest(),
      files: JAVA_FILES,
      ...overrides,
    });

  it('resolve o runtime de params pelo stage, com fallback em default', () => {
    expect(validateJava({ stage: 'local' }).errors).toEqual([]);
    expect(validateJava({ stage: 'prod' }).errors).toEqual([]);
    expect(
      validateJava({
        raw: javaManifest().replace('runtime: java21', 'runtime: java17'),
      }).errors,
    ).toEqual([
      'O runtime Java deve ser um de java21, provided.al2023, recebido "java17".',
    ]);
  });

  it('exige o build do Gradle e o artefato declarado', () => {
    expect(validateJava({ files: {} }).errors).toEqual([
      'Falta build.gradle.kts (ou build.gradle) na raiz do projeto.',
      'Artefato build/function.zip não encontrado; rode o target de build antes de "deploy".',
    ]);
    expect(validateJava({ operation: 'remove', files: {} }).errors).toEqual([
      'Falta build.gradle.kts (ou build.gradle) na raiz do projeto.',
    ]);
  });

  it('exige package.artifact declarado e só avisa quando ele usa variável', () => {
    const withoutArtifact = javaManifest().replace(
      /\n {4}package:\n {6}artifact: .*\n/,
      '\n',
    );
    expect(validateJava({ raw: withoutArtifact }).errors).toEqual([
      'Declare o artefato em package.artifact (do serviço ou da função).',
    ]);

    const report = validateJava({
      raw: javaManifest('${self:custom.zip}'),
    });
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([
      'O artefato "${self:custom.zip}" usa variável; a existência não foi verificada.',
    ]);
  });
});

describe('validateServerlessProject com valores ausentes no manifesto', () => {
  const rawWith = ({
    service = 'service: my-service\n',
    provider,
    extra = '',
  }: {
    service?: string;
    provider: string;
    extra?: string;
  }) => `${service}custom:
  nxServerless:
    type: http
${provider}${extra}`;

  const AWS_WITHOUT_RUNTIME = 'provider:\n  name: aws\n';

  it('diz que o provider.name está indefinido quando ele falta', () => {
    expect(
      validate({
        raw: rawWith({ provider: 'provider:\n  runtime: nodejs24.x\n' }),
      }).errors,
    ).toEqual(['provider.name deve ser "aws", recebido "indefinido".']);
  });

  it('exige a chave service e aponta o serverless.yml do projeto', () => {
    expect(
      validate({
        raw: rawWith({
          service: '',
          provider: 'provider:\n  name: aws\n  runtime: nodejs24.x\n',
        }),
      }).errors,
    ).toEqual([
      'Falta a chave "service" em apps/services/my-service/serverless.yml.',
    ]);
  });

  it('não exige o stage na operação invoke-local', () => {
    expect(validate({ operation: 'invoke-local', stage: '' }).errors).toEqual(
      [],
    );
  });

  it('diz que o runtime está indefinido em TypeScript, Go e Java', () => {
    const raw = rawWith({ provider: AWS_WITHOUT_RUNTIME });

    expect(validate({ raw }).errors).toEqual([
      'O runtime TypeScript deve começar com "nodejs", recebido "indefinido".',
    ]);
    expect(
      validate({ stack: 'go', raw, operation: 'remove', files: {} }).errors,
    ).toEqual([
      'O runtime Go deve ser "provided.al2023", recebido "indefinido".',
      'Falta go.mod na raiz do projeto.',
    ]);
    expect(
      validate({
        stack: 'java',
        raw,
        operation: 'remove',
        files: { 'build.gradle.kts': '' },
      }).errors,
    ).toEqual([
      'O runtime Java deve ser um de java21, provided.al2023, recebido "indefinido".',
    ]);
  });

  describe('runtime vindo de params', () => {
    const javaRaw = (params: string) =>
      rawWith({
        provider: 'provider:\n  name: aws\n  runtime: ${param:runtime}\n',
        extra: params,
      });
    const validateJava = (raw: string, stage: string) =>
      validate({
        stack: 'java',
        raw,
        stage,
        operation: 'invoke-local',
        files: { 'build.gradle.kts': '' },
      });

    it('cai no default quando não há stage', () => {
      const raw = javaRaw('params:\n  default:\n    runtime: java21\n');

      expect(validateJava(raw, '').errors).toEqual([]);
    });

    it('recusa o param que não é texto e mostra a referência original', () => {
      const raw = javaRaw('params:\n  default:\n    runtime: 21\n');

      expect(validateJava(raw, 'local').errors).toEqual([
        'O runtime Java deve ser um de java21, provided.al2023, recebido "${param:runtime}".',
      ]);
    });
  });
});

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: os specs comparam a sintaxe ${...} de variáveis do Serverless.
import { readJson, readProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { parseServerlessManifest } from '../../core/serverless-manifest.js';
import { getObject, parseYamlObject } from '../../core/yaml.js';
import { serviceTsGenerator } from './generator.js';

describe('serviceTsGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('cria o projeto em apps/services com tags e arquivos do tipo http', async () => {
    await serviceTsGenerator(tree, { name: 'orders-api', skipFormat: true });

    const project = readProjectConfiguration(tree, 'orders-api');
    expect(project).toMatchObject({
      root: 'apps/services/orders-api',
      sourceRoot: 'apps/services/orders-api/src',
      projectType: 'application',
      tags: ['type:app', 'stack:ts', 'platform:serverless'],
    });
    for (const file of [
      'serverless.yml',
      'package.json',
      'tsconfig.json',
      'tsconfig.app.json',
      'tsconfig.spec.json',
      'vitest.config.mts',
      'eslint.config.mjs',
      '.gitignore',
      'README.md',
      'src/core/hello.ts',
      'src/core/hello.spec.ts',
      'src/entrypoints/lambda.ts',
      'src/entrypoints/lambda.spec.ts',
      'src/entrypoints/logger.ts',
      'src/entrypoints/logger.spec.ts',
    ]) {
      expect(tree.exists(`apps/services/orders-api/${file}`)).toBe(true);
    }
  });

  it('gera o serverless.yml com framework 4, stage local, Floci e SSM', async () => {
    await serviceTsGenerator(tree, { name: 'orders-api', skipFormat: true });

    const manifest = tree.read(
      'apps/services/orders-api/serverless.yml',
      'utf-8',
    );
    expect(manifest).toContain("frameworkVersion: '4'");
    expect(manifest).toContain("stage: ${opt:stage, 'local'}");
    expect(manifest).toContain('runtime: nodejs24.x');
    expect(manifest).toContain('- serverless-localstack');
    expect(manifest).toContain(
      "${ssm:/playground/${sls:stage}/${aws:region}/orders-api/config/log-level, 'info'}",
    );
    expect(manifest).not.toMatch(/Owner|Product|canonicalTags/);
  });

  it('declara a retenção dos logs por stage, com 30 dias em prod', async () => {
    await serviceTsGenerator(tree, { name: 'orders-api', skipFormat: true });

    const manifest = parseYamlObject(
      tree.read('apps/services/orders-api/serverless.yml', 'utf-8') ?? '',
    );
    expect(getObject(manifest, 'provider')).toMatchObject({
      logRetentionInDays: '${self:custom.logRetentionInDays.${sls:stage}, 7}',
    });
    expect(
      getObject(getObject(manifest, 'custom'), 'logRetentionInDays'),
    ).toEqual({ prod: 30 });
  });
  it('mantém o núcleo livre de tipos da Lambda e aponta o manifesto ao entrypoint', async () => {
    await serviceTsGenerator(tree, { name: 'orders-api', skipFormat: true });

    for (const type of ['http', 'sqs', 'scheduled'] as const) {
      const other = createTreeWithEmptyWorkspace();
      await serviceTsGenerator(other, { name: 'svc', type, skipFormat: true });
      const coreFiles = other
        .children('apps/services/svc/src/core')
        .map((file) =>
          other.read(`apps/services/svc/src/core/${file}`, 'utf-8'),
        );
      expect(coreFiles.length).toBeGreaterThan(0);
      for (const content of coreFiles) {
        expect(content).not.toContain('aws-lambda');
        expect(content).not.toContain('console.');
        expect(content).not.toContain('process.env');
      }
      expect(other.read('apps/services/svc/serverless.yml', 'utf-8')).toContain(
        'handler: src/entrypoints/lambda.handler',
      );
    }
    expect(tree.exists('apps/services/orders-api/src/handlers')).toBe(false);
  });

  it('usa Vitest e referencia o tsconfig da raiz pelo offset do projeto', async () => {
    await serviceTsGenerator(tree, {
      name: 'billing',
      directory: 'apps/services/finance/billing',
      skipFormat: true,
    });

    const tsconfig = readJson(
      tree,
      'apps/services/finance/billing/tsconfig.json',
    );
    expect(tsconfig.extends).toBe('../../../../tsconfig.base.json');
    expect(
      tree.read('apps/services/finance/billing/vitest.config.mts', 'utf-8'),
    ).toContain("name: 'billing'");
    expect(
      tree.read(
        'apps/services/finance/billing/src/core/hello.spec.ts',
        'utf-8',
      ),
    ).toContain("from 'vitest'");
  });

  it.each([
    ['sqs', 'src/core/messages.ts', 'ReportBatchItemFailures'],
    ['scheduled', 'src/core/job.ts', "'rate(1 hour)'"],
  ] as const)('gera o template %s', async (type, handler, manifestSnippet) => {
    await serviceTsGenerator(tree, { name: 'svc', type, skipFormat: true });

    expect(tree.exists(`apps/services/svc/${handler}`)).toBe(true);
    expect(tree.read('apps/services/svc/serverless.yml', 'utf-8')).toContain(
      manifestSnippet,
    );
  });

  it('limita as retentativas e a idade do evento no template scheduled', async () => {
    await serviceTsGenerator(tree, {
      name: 'svc',
      type: 'scheduled',
      skipFormat: true,
    });

    const manifest = parseYamlObject(
      tree.read('apps/services/svc/serverless.yml', 'utf-8') ?? '',
    );
    expect(
      getObject(getObject(manifest, 'functions'), 'handler'),
    ).toMatchObject({ maximumRetryAttempts: 1, maximumEventAge: 3600 });
  });

  it('trata o erro do handler http com 500 genérico e log', async () => {
    await serviceTsGenerator(tree, { name: 'svc', skipFormat: true });

    const handler =
      tree.read('apps/services/svc/src/entrypoints/lambda.ts', 'utf-8') ?? '';
    expect(handler).toContain("log('error', 'unhandled_error'");
    expect(handler).toContain('statusCode: 500');
    expect(handler).not.toContain('error.message');
  });

  it('adiciona as dependências na raiz, salvo com skipPackageJson', async () => {
    await serviceTsGenerator(tree, { name: 'a', skipFormat: true });
    expect(readJson(tree, 'package.json').devDependencies).toMatchObject({
      serverless: '4.46.0',
      'serverless-localstack': '1.4.0',
      '@types/aws-lambda': expect.any(String),
    });

    const other = createTreeWithEmptyWorkspace();
    await serviceTsGenerator(other, {
      name: 'b',
      skipFormat: true,
      skipPackageJson: true,
    });
    expect(
      readJson(other, 'package.json').devDependencies ?? {},
    ).not.toHaveProperty('serverless');
  });

  it('aplica domínio e tags extras', async () => {
    await serviceTsGenerator(tree, {
      name: 'svc',
      domain: 'orders',
      tags: 'team:core, type:app',
      skipFormat: true,
    });

    expect(readProjectConfiguration(tree, 'svc').tags).toEqual([
      'type:app',
      'stack:ts',
      'platform:serverless',
      'scope:orders',
      'team:core',
    ]);
  });

  it('recusa nome inválido, projeto duplicado, diretório fora do workspace e runtime não Node', async () => {
    await expect(
      serviceTsGenerator(tree, { name: 'Orders_API', skipFormat: true }),
    ).rejects.toThrow(/kebab-case/);

    await serviceTsGenerator(tree, { name: 'svc', skipFormat: true });
    await expect(
      serviceTsGenerator(tree, { name: 'svc', skipFormat: true }),
    ).rejects.toThrow(/já existe/);

    await expect(
      serviceTsGenerator(tree, {
        name: 'out',
        directory: '../fora',
        skipFormat: true,
      }),
    ).rejects.toThrow(/relativo/);

    await expect(
      serviceTsGenerator(tree, {
        name: 'py',
        runtime: 'python3.12',
        skipFormat: true,
      }),
    ).rejects.toThrow(/nodejs/);
  });
  describe('fila do tipo sqs', () => {
    const manifestFor = async (queue?: 'external' | 'owned') => {
      const local = createTreeWithEmptyWorkspace();
      await serviceTsGenerator(local, {
        name: 'svc',
        type: 'sqs',
        skipFormat: true,
        ...(queue ? { queue } : {}),
      });
      return local.read('apps/services/svc/serverless.yml', 'utf-8') ?? '';
    };

    it('lê ARN e URL do contrato SSM por padrão, sem criar a fila', async () => {
      const raw = await manifestFor();
      const manifest = parseServerlessManifest(raw);

      expect(manifest.parsed).not.toBeNull();
      expect(raw).toContain('queue: external');
      expect(raw).toContain(
        'arn: ${ssm:/playground/${sls:stage}/${aws:region}/svc/queue/arn}',
      );
      expect(raw).toContain(
        'QUEUE_URL: ${ssm:/playground/${sls:stage}/${aws:region}/svc/queue/url}',
      );
      expect(raw).not.toMatch(/resources:|AWS::SQS::Queue/);
    });

    it('cria fila e DLQ só com queue owned', async () => {
      const raw = await manifestFor('owned');
      const manifest = parseServerlessManifest(raw);

      expect(manifest.parsed?.resources).toBeDefined();
      expect(raw).toContain('queue: owned');
      expect(raw).toContain('Fn::GetAtt: [Queue, Arn]');
      expect(raw).toContain('Fn::GetAtt: [DeadLetterQueue, Arn]');
      expect(raw).not.toContain('/queue/arn');
    });

    it('lê o contrato de uma fila compartilhada com queueParam', async () => {
      const local = createTreeWithEmptyWorkspace();
      await serviceTsGenerator(local, {
        name: 'svc',
        type: 'sqs',
        queueParam: 'shared/sample-events-queue',
        skipFormat: true,
      });
      const raw = local.read('apps/services/svc/serverless.yml', 'utf-8') ?? '';

      expect(raw).toContain(
        'arn: ${ssm:/playground/${sls:stage}/${aws:region}/shared/sample-events-queue/arn}',
      );
      expect(raw).toContain(
        'QUEUE_URL: ${ssm:/playground/${sls:stage}/${aws:region}/shared/sample-events-queue/url}',
      );
      expect(raw).not.toContain('/svc/queue/');
    });

    it.each([
      [{ type: 'sqs', queueParam: 'shared' }, /<domínio>\/<recurso>/],
      [{ type: 'sqs', queueParam: 'Shared/Fila' }, /<domínio>\/<recurso>/],
      [{ type: 'sqs', queueParam: 'a/b/c' }, /<domínio>\/<recurso>/],
      [
        { type: 'sqs', queue: 'owned', queueParam: 'shared/fila' },
        /queue external/,
      ],
      [{ type: 'http', queueParam: 'shared/fila' }, /queue external/],
    ] as const)('recusa queueParam em %o', async (options, message) => {
      await expect(
        serviceTsGenerator(tree, { name: 'svc', skipFormat: true, ...options }),
      ).rejects.toThrow(message);
    });

    it('recusa queue fora do tipo sqs e valor desconhecido', async () => {
      await expect(
        serviceTsGenerator(tree, {
          name: 'api',
          type: 'http',
          queue: 'owned',
          skipFormat: true,
        }),
      ).rejects.toThrow(/só se aplica ao tipo sqs/);
      await expect(
        serviceTsGenerator(tree, {
          name: 'fila',
          type: 'sqs',
          queue: 'shared' as 'owned',
          skipFormat: true,
        }),
      ).rejects.toThrow(/inválido para "queue"/);
    });
  });
});

// biome-ignore-all lint/suspicious/noTemplateCurlyInString: os specs comparam a sintaxe ${...} de variáveis do Serverless.
import { join } from 'node:path';

import {
  addDependenciesToPackageJson,
  formatFiles,
  readJson,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseServerlessManifest } from '../../core/serverless-manifest.js';
import { getObject, parseYamlObject } from '../../core/yaml.js';
import { serviceGoGenerator } from './generator.js';
import { goModTidyTask } from './go-mod-tidy.js';

// WHY: o formatador real depende do que o workspace tem instalado e escreve
// aviso quando falta; o que importa aqui é o gerador chamá-lo ou não. A
// instalação das dependências delega à implementação real e só os testes de
// tarefas pós-geração trocam o retorno, para não instalar pacote nem rodar o go.
vi.mock('@nx/devkit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nx/devkit')>();
  return {
    ...actual,
    formatFiles: vi.fn(async () => undefined),
    addDependenciesToPackageJson: vi.fn(actual.addDependenciesToPackageJson),
  };
});

// WHY: o `go mod tidy` real tem spec próprio; aqui só importa quando o gerador
// o agenda e em que ordem ele roda.
vi.mock('./go-mod-tidy.js', () => ({
  goModTidyTask: vi.fn(() => vi.fn()),
}));

describe('serviceGoGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  const generate = (options: Parameters<typeof serviceGoGenerator>[1]) =>
    serviceGoGenerator(tree, {
      skipFormat: true,
      skipGoModTidy: true,
      ...options,
    });

  const read = (path: string) =>
    tree.read(`apps/services/payments/${path}`, 'utf-8');

  it('separa o núcleo em internal/core do entrypoint em cmd/<nome>', async () => {
    await generate({ name: 'payments' });

    expect(readProjectConfiguration(tree, 'payments')).toMatchObject({
      root: 'apps/services/payments',
      projectType: 'application',
      tags: ['type:app', 'stack:go', 'platform:serverless'],
    });
    for (const file of [
      'go.mod',
      'internal/core/hello.go',
      'internal/core/hello_test.go',
      'cmd/payments/main.go',
      'cmd/payments/runtime.go',
      'cmd/payments/runtime_test.go',
      'cmd/payments/router.go',
      'cmd/payments/router_test.go',
    ]) {
      expect(tree.exists(`apps/services/payments/${file}`)).toBe(true);
    }
    expect(tree.exists('apps/services/payments/tsconfig.json')).toBe(false);
    expect(tree.exists('apps/services/payments/main.go')).toBe(false);
  });

  it('escolhe o runtime pela variável AWS_LAMBDA_RUNTIME_API', async () => {
    await generate({ name: 'payments' });

    expect(read('cmd/payments/runtime.go')).toContain(
      'os.LookupEnv("AWS_LAMBDA_RUNTIME_API")',
    );
    expect(read('cmd/payments/runtime.go')).toContain('os.Getenv("PORT")');
    expect(read('cmd/payments/runtime.go')).toContain('slog.NewJSONHandler(');
    expect(read('cmd/payments/runtime.go')).toContain('os.Getenv("LOG_LEVEL")');
    expect(read('cmd/payments/main.go')).toMatch(
      /func main\(\) \{\n\tsetupLogger\(\)/,
    );
    expect(read('cmd/payments/main.go')).toContain(
      'lambda.Start(httpadapter.NewV2(router).ProxyWithContext)',
    );
    expect(read('cmd/payments/router.go')).toContain(
      '"apps/services/payments/internal/core"',
    );
    expect(read('cmd/payments/router.go')).toContain(
      'mux.HandleFunc("GET /health", health)',
    );
  });

  it('drena as requisições no shutdown e define os prazos do servidor', async () => {
    await generate({ name: 'payments' });

    const runtime = read('cmd/payments/runtime.go') ?? '';
    for (const snippet of [
      'ReadTimeout:',
      'WriteTimeout:',
      'IdleTimeout:',
      'func runServer(',
      '<-done',
    ]) {
      expect(runtime).toContain(snippet);
    }
  });

  it('recupera panic no router http sem vazar o detalhe', async () => {
    await generate({ name: 'payments' });

    const router = read('cmd/payments/router.go') ?? '';
    expect(router).toContain(
      'return assignRequestID(logRequest(recoverPanic(mux)))',
    );
    expect(router).toContain('"handler_panic"');
    expect(router).toContain('"request_completed"');
    expect(router).toContain('http.StatusInternalServerError');
  });

  it('exige o X-Message-Id no sqs e o X-Scheduled-At no scheduled', async () => {
    await generate({ name: 'queue', type: 'sqs' });
    await generate({ name: 'job', type: 'scheduled' });

    const sqs = tree.read('apps/services/queue/cmd/queue/server.go', 'utf-8');
    expect(sqs).toContain('X-Message-Id');
    expect(sqs).toContain('http.StatusBadRequest');
    expect(sqs).not.toContain('UnixNano');
    const job = tree.read('apps/services/job/cmd/job/server.go', 'utf-8');
    expect(job).toContain('X-Scheduled-At');
    expect(job).toContain('http.StatusBadRequest');
    expect(job).not.toContain('time.Now()');
  });

  it('limita as retentativas e a idade do evento no template scheduled', async () => {
    await generate({ name: 'job', type: 'scheduled' });

    const manifest = parseYamlObject(
      tree.read('apps/services/job/serverless.yml', 'utf-8') ?? '',
    );
    expect(
      getObject(getObject(manifest, 'functions'), 'handler'),
    ).toMatchObject({ maximumRetryAttempts: 1, maximumEventAge: 3600 });
  });

  it('declara aws-lambda-go-api-proxy só no template http', async () => {
    await generate({ name: 'payments' });
    expect(read('go.mod')).toBe(
      [
        'module apps/services/payments',
        '',
        'go 1.26',
        '',
        'require (',
        '\tgithub.com/aws/aws-lambda-go v1.55.1',
        '\tgithub.com/awslabs/aws-lambda-go-api-proxy v0.16.2',
        ')',
        '',
      ].join('\n'),
    );

    await generate({ name: 'queue', type: 'sqs' });
    expect(tree.read('apps/services/queue/go.mod', 'utf-8')).not.toContain(
      'aws-lambda-go-api-proxy',
    );
  });

  it('aponta o build e o artefato no manifesto', async () => {
    await generate({ name: 'payments' });

    const manifest = read('serverless.yml');
    expect(manifest).toContain('goPackage: cmd/payments');
    expect(manifest).toContain('runtime: provided.al2023');
    expect(manifest).toContain("architecture: ${env:SLS_ARCH, 'arm64'}");
    expect(manifest).toContain('artifact: .bin/bootstrap.zip');
    expect(manifest).toContain("stage: ${opt:stage, 'local'}");
    expect(manifest).not.toContain('serverless-go-plugin');
  });

  it('declara a retenção dos logs por stage, com 30 dias em prod', async () => {
    await generate({ name: 'payments' });

    const manifest = parseYamlObject(read('serverless.yml') ?? '');
    expect(getObject(manifest, 'provider')).toMatchObject({
      logRetentionInDays: '${self:custom.logRetentionInDays.${sls:stage}, 7}',
    });
    expect(
      getObject(getObject(manifest, 'custom'), 'logRetentionInDays'),
    ).toEqual({ prod: 30 });
  });

  it('traduz amd64 para x86_64 no manifesto e aceita módulo customizado', async () => {
    await generate({
      name: 'payments',
      architecture: 'amd64',
      modulePath: 'github.com/acme/payments',
      goVersion: '1.27',
    });

    expect(read('serverless.yml')).toContain(
      "architecture: ${env:SLS_ARCH, 'x86_64'}",
    );
    expect(read('go.mod')).toMatch(
      /^module github\.com\/acme\/payments\n\ngo 1\.27\n/,
    );
    expect(read('cmd/payments/router.go')).toContain(
      '"github.com/acme/payments/internal/core"',
    );
  });

  it.each([
    ['sqs', 'internal/core/messages.go', 'cmd/svc/lambda.go', 'POST /messages'],
    ['scheduled', 'internal/core/job.go', 'cmd/svc/lambda.go', 'POST /run'],
  ] as const)('gera o template %s', async (type, core, lambda, route) => {
    await generate({ name: 'svc', type });

    expect(tree.exists(`apps/services/svc/${core}`)).toBe(true);
    expect(tree.read(`apps/services/svc/${core}`, 'utf-8')).not.toContain(
      'log/slog',
    );
    expect(tree.exists(`apps/services/svc/${lambda}`)).toBe(true);
    expect(tree.read('apps/services/svc/cmd/svc/server.go', 'utf-8')).toContain(
      route,
    );
    expect(tree.read('apps/services/svc/cmd/svc/server.go', 'utf-8')).toContain(
      'GET /health',
    );
  });

  it('usa o contrato informado em queueParam', async () => {
    await generate({
      name: 'svc',
      type: 'sqs',
      queueParam: 'shared/sample-events-queue',
    });

    const raw = tree.read('apps/services/svc/serverless.yml', 'utf-8') ?? '';
    expect(raw).toContain('/shared/sample-events-queue/arn}');
    expect(raw).toContain('/shared/sample-events-queue/url}');
  });

  it('adiciona serverless e serverless-localstack na raiz, salvo com skipPackageJson', async () => {
    await generate({ name: 'a' });
    expect(readJson(tree, 'package.json').devDependencies).toMatchObject({
      serverless: '4.46.0',
      'serverless-localstack': '1.4.0',
    });

    const other = createTreeWithEmptyWorkspace();
    await serviceGoGenerator(other, {
      name: 'b',
      skipFormat: true,
      skipGoModTidy: true,
      skipPackageJson: true,
    });
    expect(
      readJson(other, 'package.json').devDependencies ?? {},
    ).not.toHaveProperty('serverless');
  });

  it('recusa arquitetura e tipo desconhecidos', async () => {
    await expect(
      generate({ name: 'x', architecture: 'x86' as 'amd64' }),
    ).rejects.toThrow(/Arquitetura/);
    await expect(
      generate({ name: 'y', type: 'kafka' as 'http' }),
    ).rejects.toThrow(/não suportado/);
  });
  it.each([
    ['external', '/svc/queue/arn}', 'AWS::SQS::Queue'],
    ['owned', 'Fn::GetAtt: [Queue, Arn]', '/svc/queue/arn'],
  ] as const)(
    'no sqs com queue %s, o manifesto é válido e coerente',
    async (queue, present, absent) => {
      await generate({ name: 'svc', type: 'sqs', queue });

      const raw = tree.read('apps/services/svc/serverless.yml', 'utf-8') ?? '';
      expect(parseServerlessManifest(raw).goPackage).toBe('cmd/svc');
      expect(raw).toContain(`queue: ${queue}`);
      expect(raw).toContain(present);
      expect(raw).not.toContain(absent);
    },
  );
});

describe('serviceGoGenerator: formatação e tarefas depois da geração', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.clearAllMocks();
  });

  it('formata os arquivos gerados quando skipFormat não é informado', async () => {
    await serviceGoGenerator(tree, { name: 'a', skipGoModTidy: true });

    expect(formatFiles).toHaveBeenCalledWith(tree);
  });

  it('não formata com skipFormat', async () => {
    await serviceGoGenerator(tree, {
      name: 'a',
      skipFormat: true,
      skipGoModTidy: true,
    });

    expect(formatFiles).not.toHaveBeenCalled();
  });

  it('agenda o go mod tidy na pasta do serviço e o roda depois da instalação', async () => {
    const install = vi.fn();
    const tidy = vi.fn();
    vi.mocked(addDependenciesToPackageJson).mockReturnValueOnce(install);
    vi.mocked(goModTidyTask).mockReturnValueOnce(tidy);

    const afterGenerate = await serviceGoGenerator(tree, {
      name: 'a',
      skipFormat: true,
    });

    expect(goModTidyTask).toHaveBeenCalledWith(
      join(tree.root, 'apps/services/a'),
    );
    expect(install).not.toHaveBeenCalled();
    expect(tidy).not.toHaveBeenCalled();

    await afterGenerate();

    expect(install).toHaveBeenCalledOnce();
    expect(tidy).toHaveBeenCalledOnce();
    expect(install.mock.invocationCallOrder[0]).toBeLessThan(
      tidy.mock.invocationCallOrder[0],
    );
  });

  it('não agenda o go mod tidy com skipGoModTidy e só instala as dependências', async () => {
    const install = vi.fn();
    vi.mocked(addDependenciesToPackageJson).mockReturnValueOnce(install);

    const afterGenerate = await serviceGoGenerator(tree, {
      name: 'a',
      skipFormat: true,
      skipGoModTidy: true,
    });
    await afterGenerate();

    expect(goModTidyTask).not.toHaveBeenCalled();
    expect(install).toHaveBeenCalledOnce();
  });

  it('não instala nada com skipPackageJson e skipGoModTidy', async () => {
    const afterGenerate = await serviceGoGenerator(tree, {
      name: 'a',
      skipFormat: true,
      skipGoModTidy: true,
      skipPackageJson: true,
    });

    await expect(afterGenerate()).resolves.toBeUndefined();
    expect(addDependenciesToPackageJson).not.toHaveBeenCalled();
  });
});

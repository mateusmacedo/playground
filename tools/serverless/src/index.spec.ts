import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { CreateNodesContextV2 } from '@nx/devkit';
import { workspaceDataDirectory } from '@nx/devkit/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveServerlessTargets } from './core/resolve-serverless-targets.js';
import {
  createNodes,
  createNodesV2,
  pluginSourceHash,
  resolvePluginLocation,
} from './index.js';

// WHY: o cache de inferência é gravado em `workspaceDataDirectory`, que aponta
// para o `.nx` do repositório; os testes usam uma pasta temporária para não
// escrever no workspace real. O hash dos arquivos vem do contexto nativo do Nx,
// que fixa a raiz do primeiro workspace do processo; aqui ele vira o hash do
// conteúdo do manifesto, para cada workspace temporário ter o seu.
vi.mock('@nx/devkit/internal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nx/devkit/internal')>();
  const { createHash } = await import('node:crypto');
  const { mkdtempSync: makeTempDir, readFileSync } = await import('node:fs');
  const { tmpdir: tempRoot } = await import('node:os');
  const { join: joinPath } = await import('node:path');
  return {
    ...actual,
    workspaceDataDirectory: makeTempDir(
      joinPath(tempRoot(), 'nx-serverless-workspace-data-'),
    ),
    calculateHashesForCreateNodes: async (
      projectRoots: string[],
      _inputs: object,
      context: { workspaceRoot: string },
    ) =>
      projectRoots.map((projectRoot) =>
        createHash('sha256')
          .update(
            readFileSync(
              joinPath(context.workspaceRoot, projectRoot, 'serverless.yml'),
            ),
          )
          .digest('hex'),
      ),
  };
});

// NOTE: o spy delega à implementação real; serve para contar quantas vezes o
// cache deixou de valer.
vi.mock('./core/resolve-serverless-targets.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('./core/resolve-serverless-targets.js')
    >();
  return {
    resolveServerlessTargets: vi.fn(actual.resolveServerlessTargets),
  };
});

describe('resolvePluginLocation', () => {
  it('usa o caminho relativo quando o plugin vive no workspace', () => {
    expect(resolvePluginLocation('/repo', '/repo/tools/serverless')).toEqual({
      executorPrefix: './tools/serverless',
      pluginSourceInput: '{workspaceRoot}/tools/serverless/src/**/*',
    });
  });

  it('usa o nome do pacote quando o plugin vem de node_modules ou de fora', () => {
    const fromPackage = {
      executorPrefix: '@org/nx-serverless',
      pluginSourceInput: undefined,
    };
    expect(
      resolvePluginLocation('/repo', '/repo/node_modules/@org/nx-serverless'),
    ).toEqual(fromPackage);
    expect(resolvePluginLocation('/repo', '/outro/plugin')).toEqual(
      fromPackage,
    );
  });
});

describe('createNodes', () => {
  it('observa os serverless.yml e mantém o alias createNodesV2', () => {
    expect(createNodes[0]).toBe('**/serverless.yml');
    expect(createNodesV2).toBe(createNodes);
  });
});

describe('pluginSourceHash', () => {
  const pluginWith = (files: Record<string, string>): string => {
    const root = mkdtempSync(join(tmpdir(), 'nx-serverless-hash-'));
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(root, 'src', path, '..'), { recursive: true });
      writeFileSync(join(root, 'src', path), content);
    }
    return root;
  };

  it('muda quando o código do plugin muda e ignora os specs', () => {
    const base = { 'a.ts': 'x', 'b/c.json': '{}', 'a.spec.ts': 'teste' };
    const original = pluginSourceHash(pluginWith(base));

    expect(pluginSourceHash(pluginWith(base))).toBe(original);
    expect(
      pluginSourceHash(pluginWith({ ...base, 'a.spec.ts': 'outro' })),
    ).toBe(original);
    expect(pluginSourceHash(pluginWith({ ...base, 'a.ts': 'y' }))).not.toBe(
      original,
    );
  });
});

describe('pluginSourceHash do próprio plugin', () => {
  it('guarda o hash e devolve o mesmo nas chamadas seguintes', () => {
    const first = pluginSourceHash();

    expect(pluginSourceHash()).toBe(first);
  });
});

describe('createNodes inferindo os projetos', () => {
  const [, createNodesFunction] = createNodes;
  const CONFIG_FILE = 'apps/services/svc/serverless.yml';

  const manifestFor = (service: string) => `service: ${service}
custom:
  nxServerless:
    language: typescript
provider:
  name: aws
  runtime: nodejs24.x
`;

  const workspaceWith = (manifest: string): string => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-serverless-nodes-'));
    mkdirSync(join(workspaceRoot, 'apps/services/svc'), { recursive: true });
    writeFileSync(join(workspaceRoot, CONFIG_FILE), manifest);
    return workspaceRoot;
  };

  const contextFor = (workspaceRoot: string): CreateNodesContextV2 => ({
    workspaceRoot,
    nxJsonConfiguration: {},
  });

  const infer = (
    workspaceRoot: string,
    options?: Parameters<typeof createNodesFunction>[1],
  ) => createNodesFunction([CONFIG_FILE], options, contextFor(workspaceRoot));

  afterEach(() => {
    vi.mocked(resolveServerlessTargets).mockClear();
  });

  it('devolve o projeto da pasta do serverless.yml com os targets do plugin', async () => {
    const results = await infer(workspaceWith(manifestFor('inferido')));

    expect(results).toHaveLength(1);
    const [file, result] = results[0];
    expect(file).toBe(CONFIG_FILE);
    expect(Object.keys(result.projects ?? {})).toEqual(['apps/services/svc']);
    const project = result.projects?.['apps/services/svc'];
    expect(project?.root).toBe('apps/services/svc');
    expect(Object.keys(project?.targets ?? {})).toEqual([
      'pre-deploy',
      'package',
      'deploy',
      'pre-remove',
      'remove',
      'invoke-local',
    ]);
    expect(project?.metadata).toMatchObject({
      technologies: ['serverless', 'typescript'],
    });
  });

  it('aplica as opções do plugin ao inferir', async () => {
    const results = await infer(workspaceWith(manifestFor('com-opcoes')), {
      deployTargetName: 'ship',
      serverlessCommand: 'pnpm exec serverless',
    });

    const targets = results[0][1].projects?.['apps/services/svc']?.targets;
    expect(targets).toHaveProperty('ship');
    expect(targets).not.toHaveProperty('deploy');
    expect(targets?.ship?.configurations?.dev?.command).toBe(
      'pnpm exec serverless deploy --stage dev',
    );
  });

  it('grava o cache em disco e reaproveita na inferência seguinte', async () => {
    const workspaceRoot = workspaceWith(manifestFor('em-cache'));

    await infer(workspaceRoot);
    await infer(workspaceRoot);

    expect(resolveServerlessTargets).toHaveBeenCalledTimes(1);
    expect(
      readdirSync(workspaceDataDirectory).filter(
        (file) => file.startsWith('serverless-') && file.endsWith('.hash'),
      ),
    ).not.toHaveLength(0);
  });

  it('infere de novo quando o serverless.yml muda', async () => {
    const workspaceRoot = workspaceWith(manifestFor('antes'));

    await infer(workspaceRoot);
    writeFileSync(join(workspaceRoot, CONFIG_FILE), manifestFor('depois'));
    await infer(workspaceRoot);

    expect(resolveServerlessTargets).toHaveBeenCalledTimes(2);
  });
});

import { join } from 'node:path';

import { type ExecutorContext, logger } from '@nx/devkit';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildGoLambdaArtifact } from '../../languages/go/build-go-lambda-artifact.js';
import goBuildExecutor from './executor.js';

// WHY: o build real já é coberto no spec do próprio artefato; aqui só importa
// o que o executor entrega a ele a partir das opções e do contexto.
vi.mock('../../languages/go/build-go-lambda-artifact.js', () => ({
  buildGoLambdaArtifact: vi.fn(() => ({ success: true })),
}));

const WORKSPACE_ROOT = '/workspace';
const PROJECT_ROOT = 'apps/services/svc';

const contextFor = (projectName: string | undefined): ExecutorContext => ({
  root: WORKSPACE_ROOT,
  cwd: WORKSPACE_ROOT,
  isVerbose: false,
  nxJsonConfiguration: {},
  projectGraph: { nodes: {}, dependencies: {} },
  projectName,
  projectsConfigurations: {
    version: 2,
    projects: { svc: { root: PROJECT_ROOT } },
  },
});

describe('goBuildExecutor', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('falha quando o projeto não está no workspace, sem compilar', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const result = await goBuildExecutor({}, contextFor('outro'));

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      'Projeto "outro" não encontrado no workspace.',
    );
    expect(buildGoLambdaArtifact).not.toHaveBeenCalled();
  });

  it('falha quando o contexto não traz o nome do projeto', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const result = await goBuildExecutor({}, contextFor(undefined));

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      'Projeto "" não encontrado no workspace.',
    );
  });

  it('compila com os padrões de build da Lambda quando não há opções', async () => {
    const result = await goBuildExecutor({}, contextFor('svc'));

    expect(result).toEqual({ success: true });
    expect(buildGoLambdaArtifact).toHaveBeenCalledWith({
      absProjectRoot: join(WORKSPACE_ROOT, PROJECT_ROOT),
      architecture: 'arm64',
      trimpath: true,
      ldflags: '-s -w',
      tags: 'lambda.norpc',
      packagePath: undefined,
    });
  });

  it('repassa as opções informadas, inclusive trimpath desligado', async () => {
    await goBuildExecutor(
      {
        architecture: 'amd64',
        trimpath: false,
        ldflags: '-X main.version=1',
        tags: 'lambda.norpc,extra',
        packagePath: 'cmd/svc',
      },
      contextFor('svc'),
    );

    expect(buildGoLambdaArtifact).toHaveBeenCalledWith({
      absProjectRoot: join(WORKSPACE_ROOT, PROJECT_ROOT),
      architecture: 'amd64',
      trimpath: false,
      ldflags: '-X main.version=1',
      tags: 'lambda.norpc,extra',
      packagePath: 'cmd/svc',
    });
  });

  it('devolve o resultado do build sem alterá-lo', async () => {
    vi.mocked(buildGoLambdaArtifact).mockReturnValueOnce({ success: false });

    expect(await goBuildExecutor({}, contextFor('svc'))).toEqual({
      success: false,
    });
  });

  it('devolve uma rejeição, e não lança, quando o build lança um erro', async () => {
    vi.mocked(buildGoLambdaArtifact).mockImplementationOnce(() => {
      throw new Error('falha inesperada no build');
    });

    const result = goBuildExecutor({}, contextFor('svc'));

    await expect(result).rejects.toThrow('falha inesperada no build');
  });
});

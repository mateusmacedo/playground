import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { type ExecutorContext, logger } from '@nx/devkit';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';

import validateExecutor from './executor.js';

const PROJECT_ROOT = 'apps/services/svc';

const VALID_MANIFEST = `service: svc
custom:
  nxServerless:
    language: typescript
provider:
  name: aws
  runtime: nodejs24.x
`;

function workspaceWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'nx-serverless-validate-exec-'));
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(root, PROJECT_ROOT, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }
  return root;
}

// NOTE: `null` representa o contexto sem nome de projeto; `undefined` usaria o
// padrão do parâmetro.
const contextFor = (
  root: string,
  projectName: string | null = 'svc',
): ExecutorContext => ({
  root,
  cwd: root,
  isVerbose: false,
  nxJsonConfiguration: {},
  projectGraph: { nodes: {}, dependencies: {} },
  projectName: projectName ?? undefined,
  projectsConfigurations: {
    version: 2,
    projects: { svc: { root: PROJECT_ROOT } },
  },
});

describe('validateExecutor', () => {
  let error: MockInstance<typeof logger.error>;
  let warn: MockInstance<typeof logger.warn>;

  beforeEach(() => {
    error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falha quando o projeto não está no workspace', async () => {
    const root = workspaceWith({});

    const result = await validateExecutor(
      { stack: 'typescript', stage: 'local' },
      contextFor(root, 'outro'),
    );

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      'Projeto "outro" não encontrado no workspace.',
    );
  });

  it('falha quando o projeto nem tem nome no contexto', async () => {
    const root = workspaceWith({});

    const result = await validateExecutor(
      { stack: 'typescript', stage: 'local' },
      contextFor(root, null),
    );

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      'Projeto "" não encontrado no workspace.',
    );
  });

  it('falha quando o manifesto não existe na pasta do projeto', async () => {
    const root = workspaceWith({ 'package.json': '{}' });

    const result = await validateExecutor(
      { stack: 'typescript', stage: 'local' },
      contextFor(root),
    );

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      `Manifesto serverless.yml não encontrado em ${PROJECT_ROOT}.`,
    );
  });

  it('aprova o projeto válido sem registrar erro', async () => {
    const root = workspaceWith({
      'serverless.yml': VALID_MANIFEST,
      'package.json': '{}',
      'tsconfig.json': '{}',
    });

    const result = await validateExecutor(
      { stack: 'typescript', stage: 'local' },
      contextFor(root),
    );

    expect(result).toEqual({ success: true });
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('respeita a operação informada e bloqueia o remove em prod', async () => {
    const root = workspaceWith({
      'serverless.yml': VALID_MANIFEST,
      'package.json': '{}',
      'tsconfig.json': '{}',
    });

    const result = await validateExecutor(
      { stack: 'typescript', operation: 'remove', stage: 'prod' },
      contextFor(root),
    );

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      'Remoção em "prod" bloqueada pelo plugin; siga o runbook de descomissionamento.',
    );
  });

  it('exige o stage no deploy quando a operação não é informada', async () => {
    const root = workspaceWith({
      'serverless.yml': VALID_MANIFEST,
      'package.json': '{}',
      'tsconfig.json': '{}',
    });

    const result = await validateExecutor(
      { stack: 'typescript' },
      contextFor(root),
    );

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      'O stage é obrigatório para a operação "deploy".',
    );
  });

  it('lê o manifesto do configPath informado e registra os erros', async () => {
    const root = workspaceWith({
      'serverless.local.yml': 'service: MeuServico\n',
    });

    const result = await validateExecutor(
      {
        stack: 'typescript',
        stage: 'local',
        configPath: 'serverless.local.yml',
      },
      contextFor(root),
    );

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      'O nome do serviço "MeuServico" deve ser kebab-case.',
    );
  });

  it('registra os avisos sem reprovar o projeto', async () => {
    const root = workspaceWith({
      'serverless.yml': `service: svc
custom:
  nxServerless:
    language: go
provider:
  name: aws
  runtime: provided.al2023
package:
  artifact: \${self:custom.zip}
`,
      'go.mod': 'module x\n',
    });

    const result = await validateExecutor(
      { stack: 'go', stage: 'local' },
      contextFor(root),
    );

    expect(result).toEqual({ success: true });
    expect(warn).toHaveBeenCalledWith(
      'Nenhum main.go encontrado na raiz nem em cmd/*/.',
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('devolve uma rejeição, e não lança, quando a leitura do manifesto falha', async () => {
    // NOTE: um diretório no lugar do serverless.yml passa no existsSync e
    // falha no readFileSync (EISDIR).
    const root = workspaceWith({ 'serverless.yml/leia-me.txt': 'x' });

    const result = validateExecutor(
      { stack: 'typescript', stage: 'local' },
      contextFor(root),
    );

    await expect(result).rejects.toThrow(/EISDIR/);
  });
});

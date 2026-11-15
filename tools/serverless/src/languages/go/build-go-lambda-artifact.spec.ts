import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { logger } from '@nx/devkit';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LAMBDA_BINARY_NAME,
  LAMBDA_OUTPUT_DIR,
} from '../../shared/constants.js';
import {
  buildGoLambdaArtifact,
  goBuildArgs,
  normalizePackagePath,
  writeFileAtomic,
} from './build-go-lambda-artifact.js';

// NOTE: o go falso responde ao `version` e ao `build` (gravando o binário no
// `-o`), com o código de saída de cada um vindo do ambiente do teste.
const FAKE_GO = `#!/bin/sh
if [ "$1" = "version" ]; then exit "\${FAKE_GO_VERSION_EXIT:-0}"; fi
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then printf 'binario' > "$2"; fi
  shift
done
exit "\${FAKE_GO_BUILD_EXIT:-0}"
`;

const BUILD_OPTIONS = {
  architecture: 'arm64',
  trimpath: true,
  ldflags: '-s -w',
  tags: 'lambda.norpc',
};

function goProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), 'nx-serverless-go-project-'));
  writeFileSync(join(projectDir, 'go.mod'), 'module example\n');
  return projectDir;
}

function pathWithFakeGo(): string {
  const binDir = mkdtempSync(join(tmpdir(), 'nx-serverless-fake-go-'));
  const goPath = join(binDir, 'go');
  writeFileSync(goPath, FAKE_GO);
  chmodSync(goPath, 0o755);
  return binDir;
}

describe('goBuildArgs', () => {
  it('monta as flags de build reprodutível da Lambda', () => {
    expect(
      goBuildArgs(
        { trimpath: true, ldflags: '-s -w', tags: 'lambda.norpc' },
        '/p/.bin/bootstrap',
        undefined,
      ),
    ).toEqual([
      'build',
      '-buildvcs=false',
      '-trimpath',
      '-tags',
      'lambda.norpc',
      '-ldflags',
      '-s -w',
      '-o',
      '/p/.bin/bootstrap',
    ]);
  });

  it('omite -trimpath quando desligado e compila o pacote informado', () => {
    const args = goBuildArgs(
      { trimpath: false, ldflags: '', tags: 't' },
      'out',
      'cmd/api',
    );
    expect(args).not.toContain('-trimpath');
    expect(args.at(-1)).toBe('./cmd/api');
  });
});

describe('normalizePackagePath', () => {
  it('normaliza caminhos relativos válidos', () => {
    expect(normalizePackagePath(' cmd/api/ ')).toEqual({ path: 'cmd/api' });
    expect(normalizePackagePath('cmd/./api')).toEqual({ path: 'cmd/api' });
  });

  it.each(['', '.', '/abs', 'C:/x', 'cmd\\api', '../fora', 'cmd/..'])(
    'recusa "%s"',
    (value) => {
      expect(normalizePackagePath(value)).toHaveProperty('error');
    },
  );
});

describe('buildGoLambdaArtifact', () => {
  it('recusa arquitetura fora da lista antes de chamar o Go', () => {
    expect(
      buildGoLambdaArtifact({
        absProjectRoot: '/inexistente',
        architecture: 'x86_64',
        trimpath: true,
        ldflags: '-s -w',
        tags: 'lambda.norpc',
      }),
    ).toEqual({ success: false });
  });
});

describe('buildGoLambdaArtifact com o Go do PATH', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('falha quando não há go numa pasta confiável do PATH', () => {
    vi.stubEnv('PATH', mkdtempSync(join(tmpdir(), 'nx-serverless-empty-')));
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const result = buildGoLambdaArtifact({
      absProjectRoot: goProject(),
      ...BUILD_OPTIONS,
    });

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(expect.stringContaining('PATH'));
  });

  it('falha quando o go version falha', () => {
    vi.stubEnv('PATH', pathWithFakeGo());
    vi.stubEnv('FAKE_GO_VERSION_EXIT', '1');
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const result = buildGoLambdaArtifact({
      absProjectRoot: goProject(),
      ...BUILD_OPTIONS,
    });

    expect(result).toEqual({ success: false });
  });

  it('falha com o código de saída quando o go build falha', () => {
    vi.stubEnv('PATH', pathWithFakeGo());
    vi.stubEnv('FAKE_GO_BUILD_EXIT', '2');
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const result = buildGoLambdaArtifact({
      absProjectRoot: goProject(),
      ...BUILD_OPTIONS,
    });

    expect(result).toEqual({ success: false });
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('código de saída 2'),
    );
  });

  it('gera o zip com o binário quando o build passa', () => {
    vi.stubEnv('PATH', pathWithFakeGo());
    vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const projectDir = goProject();

    const result = buildGoLambdaArtifact({
      absProjectRoot: projectDir,
      ...BUILD_OPTIONS,
    });

    expect(result).toEqual({ success: true });
    expect(
      existsSync(
        join(projectDir, LAMBDA_OUTPUT_DIR, `${LAMBDA_BINARY_NAME}.zip`),
      ),
    ).toBe(true);
  });
});

describe('writeFileAtomic', () => {
  const tempDir = () => mkdtempSync(join(tmpdir(), 'nx-serverless-atomic-'));

  it('grava o conteúdo e não deixa o arquivo temporário para trás', () => {
    const path = join(tempDir(), 'bootstrap.zip');

    writeFileAtomic(path, Buffer.from('novo'));

    expect(readFileSync(path, 'utf-8')).toBe('novo');
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });

  it('substitui o artefato anterior e repete sem erro', () => {
    const path = join(tempDir(), 'bootstrap.zip');
    writeFileSync(path, 'antigo');

    writeFileAtomic(path, Buffer.from('novo'));
    writeFileAtomic(path, Buffer.from('novo'));

    expect(readFileSync(path, 'utf-8')).toBe('novo');
  });

  it('mantém o artefato anterior quando a escrita falha', () => {
    const path = join(tempDir(), 'bootstrap.zip');
    writeFileSync(path, 'antigo');
    // WHY: um diretório no lugar do `.tmp` faz o writeFileSync falhar (EISDIR),
    // sem depender de disco cheio nem de permissão.
    mkdirSync(`${path}.tmp`);

    expect(() => writeFileAtomic(path, Buffer.from('novo'))).toThrow();

    expect(readFileSync(path, 'utf-8')).toBe('antigo');
  });
});

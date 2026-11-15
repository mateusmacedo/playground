import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { resolveExecutable } from './resolve-executable.js';

const TRUSTED_MODE = 0o755;
const WORLD_WRITABLE_MODE = 0o777;

function createDirectory(mode: number): string {
  const directory = mkdtempSync(join(tmpdir(), 'nx-serverless-exec-'));
  chmodSync(directory, mode);
  return directory;
}

function createFile({
  directory,
  name,
  mode,
}: {
  directory: string;
  name: string;
  mode: number;
}): string {
  const path = join(directory, name);
  writeFileSync(path, '#!/bin/sh\n');
  chmodSync(path, mode);
  return path;
}

describe('resolveExecutable', () => {
  it('devolve o caminho absoluto do binário numa pasta confiável', () => {
    const directory = createDirectory(TRUSTED_MODE);
    const binary = createFile({ directory, name: 'go', mode: 0o755 });

    const resolved = resolveExecutable({
      name: 'go',
      searchPath: directory,
      platform: 'linux',
    });

    expect(resolved).toBe(binary);
  });

  it('ignora entradas relativas e vazias do PATH', () => {
    const directory = createDirectory(TRUSTED_MODE);
    const binary = createFile({ directory, name: 'go', mode: 0o755 });

    const resolved = resolveExecutable({
      name: 'go',
      searchPath: ['', '.', 'bin', directory].join(delimiter),
      platform: 'linux',
    });

    expect(resolved).toBe(binary);
  });

  it('ignora pasta que qualquer usuário consegue gravar', () => {
    const writable = createDirectory(WORLD_WRITABLE_MODE);
    createFile({ directory: writable, name: 'go', mode: 0o755 });
    const trusted = createDirectory(TRUSTED_MODE);
    const binary = createFile({ directory: trusted, name: 'go', mode: 0o755 });

    const resolved = resolveExecutable({
      name: 'go',
      searchPath: [writable, trusted].join(delimiter),
      platform: 'linux',
    });

    expect(resolved).toBe(binary);
  });

  it('ignora arquivo sem permissão de execução e pasta com o mesmo nome', () => {
    const notExecutable = createDirectory(TRUSTED_MODE);
    createFile({ directory: notExecutable, name: 'go', mode: 0o644 });
    const withDirectory = createDirectory(TRUSTED_MODE);
    mkdirSync(join(withDirectory, 'go'));

    const resolved = resolveExecutable({
      name: 'go',
      searchPath: [notExecutable, withDirectory].join(delimiter),
      platform: 'linux',
    });

    expect(resolved).toBeUndefined();
  });

  it('devolve undefined quando a pasta do PATH não existe', () => {
    const missing = join(tmpdir(), 'nx-serverless-exec-inexistente', 'bin');

    const resolved = resolveExecutable({
      name: 'go',
      searchPath: missing,
      platform: 'linux',
    });

    expect(resolved).toBeUndefined();
  });

  it('no Windows procura com as extensões do PATHEXT', () => {
    const directory = createDirectory(TRUSTED_MODE);
    const binary = createFile({ directory, name: 'go.exe', mode: 0o755 });

    const resolved = resolveExecutable({
      name: 'go',
      searchPath: directory,
      platform: 'win32',
      pathExt: '.COM;.EXE;',
    });

    expect(resolved).toBe(binary);
  });

  it('usa o PATH do processo quando nenhum é informado', () => {
    const directory = createDirectory(TRUSTED_MODE);
    const binary = createFile({ directory, name: 'fake-tool', mode: 0o755 });
    vi.stubEnv('PATH', directory);

    const resolved = resolveExecutable({
      name: 'fake-tool',
      platform: 'linux',
    });

    expect(resolved).toBe(binary);
    vi.unstubAllEnvs();
  });
});

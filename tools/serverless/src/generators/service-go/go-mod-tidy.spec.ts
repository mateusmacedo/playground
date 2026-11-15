import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { logger } from '@nx/devkit';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { goModTidyTask } from './go-mod-tidy.js';

const FAKE_GO = `#!/bin/sh
printf '%s|%s' "$PWD" "$*" > "$FAKE_GO_RECORD"
exit "\${FAKE_GO_EXIT:-0}"
`;

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function installFakeGo(): string {
  const binDir = tempDir('nx-serverless-fake-go-');
  const goPath = join(binDir, 'go');
  writeFileSync(goPath, FAKE_GO);
  chmodSync(goPath, 0o755);
  return binDir;
}

describe('goModTidyTask', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('roda go mod tidy na pasta do projeto com o go confiável do PATH', () => {
    const projectDir = tempDir('nx-serverless-tidy-project-');
    const record = join(tempDir('nx-serverless-tidy-record-'), 'record');
    vi.stubEnv('PATH', installFakeGo());
    vi.stubEnv('FAKE_GO_RECORD', record);
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    goModTidyTask(projectDir)();

    expect(readFileSync(record, 'utf-8')).toBe(`${projectDir}|mod tidy`);
    expect(warn).not.toHaveBeenCalled();
  });

  it('avisa quando não há go confiável no PATH', () => {
    const projectDir = tempDir('nx-serverless-tidy-project-');
    vi.stubEnv('PATH', tempDir('nx-serverless-empty-path-'));
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    goModTidyTask(projectDir)();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(projectDir));
  });

  it('avisa quando o go mod tidy falha', () => {
    const projectDir = tempDir('nx-serverless-tidy-project-');
    const record = join(tempDir('nx-serverless-tidy-record-'), 'record');
    vi.stubEnv('PATH', installFakeGo());
    vi.stubEnv('FAKE_GO_RECORD', record);
    vi.stubEnv('FAKE_GO_EXIT', '1');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    goModTidyTask(projectDir)();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('go mod tidy'));
  });
});

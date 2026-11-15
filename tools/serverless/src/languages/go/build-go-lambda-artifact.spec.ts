import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildGoLambdaArtifact,
  goBuildArgs,
  normalizePackagePath,
  writeFileAtomic,
} from './build-go-lambda-artifact.js';

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

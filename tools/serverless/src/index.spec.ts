import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createNodes,
  createNodesV2,
  pluginSourceHash,
  resolvePluginLocation,
} from './index.js';

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

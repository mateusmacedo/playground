import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  detectServerlessBin,
  resolveServerlessCommand,
} from './serverless-cli.js';

function workspaceWithServerless(packageJson?: object): string {
  const root = mkdtempSync(join(tmpdir(), 'nx-serverless-cli-'));
  if (packageJson) {
    const dir = join(root, 'node_modules', 'serverless');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify(packageJson));
  }
  return root;
}

describe('detectServerlessBin', () => {
  it('lê o bin serverless do pacote instalado na raiz', () => {
    expect(
      detectServerlessBin(
        workspaceWithServerless({
          bin: { sls: 'run.js', serverless: 'run.js' },
        }),
      ),
    ).toBe('node_modules/serverless/run.js');
    expect(
      detectServerlessBin(workspaceWithServerless({ bin: './bin/cli.js' })),
    ).toBe('node_modules/serverless/bin/cli.js');
  });

  it('não encontra o bin quando o pacote não está instalado', () => {
    expect(detectServerlessBin(workspaceWithServerless())).toBeUndefined();
    expect(
      detectServerlessBin(workspaceWithServerless({ name: 'serverless' })),
    ).toBeUndefined();
  });
});

describe('resolveServerlessCommand', () => {
  const bin = 'node_modules/serverless/run.js';

  it('chama o bin com node, relativo à raiz do projeto', () => {
    expect(resolveServerlessCommand('apps/services/svc', bin, undefined)).toBe(
      'node ../../../node_modules/serverless/run.js',
    );
    expect(resolveServerlessCommand('.', bin, undefined)).toBe(
      'node node_modules/serverless/run.js',
    );
  });

  it('respeita o override e cai para o PATH sem pacote instalado', () => {
    expect(resolveServerlessCommand('apps/x', bin, 'npx serverless')).toBe(
      'npx serverless',
    );
    expect(resolveServerlessCommand('apps/x', undefined, undefined)).toBe(
      'serverless',
    );
  });
});

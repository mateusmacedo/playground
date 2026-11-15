import { describe, expect, it, vi } from 'vitest';

// WHY: o `createRequire` é trocado para simular o pnpm que não expõe o `yaml`
// a quem não o declara; num arquivo à parte, porque o módulo guarda o `yaml`
// carregado e o fallback só roda na primeira leitura.
const fallbackYaml = vi.hoisted(() => ({
  parseDocument: () => ({ errors: [], toJS: () => ({ origem: 'nx' }) }),
}));

vi.mock('node:module', () => {
  const requireFromNx = () => fallbackYaml;
  const requireFromPlugin = Object.assign(
    () => {
      throw new Error("Cannot find module 'yaml'");
    },
    { resolve: () => '/workspace/node_modules/nx/package.json' },
  );
  let calls = 0;
  return {
    createRequire: () => {
      calls += 1;
      return calls === 1 ? requireFromPlugin : requireFromNx;
    },
  };
});

describe('parseYamlObject sem o yaml na raiz do workspace', () => {
  it('carrega a cópia do yaml que acompanha o nx', async () => {
    const { parseYamlObject } = await import('./yaml.js');

    expect(parseYamlObject('a: 1')).toEqual({ origem: 'nx' });
  });
});

import { createRequire } from 'node:module';

import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

// WHY: a classe estende o `VersionActions` real do Nx. Assim o teste também
// pega um upgrade do Nx que adicione um membro abstrato que a classe não
// implementa, e nada precisa simular o git: o arquivo não o chama.
const { VersionActions } = require('nx/release');
const GitTagVersionActions = require('./git-tag-version-actions.cjs');

// NOTE: membros abstratos de `VersionActions` no Nx 24.
const ABSTRACT_MEMBERS = [
  'readCurrentVersionFromSourceManifest',
  'readCurrentVersionFromRegistry',
  'readCurrentVersionOfDependency',
  'updateProjectVersion',
  'updateProjectDependencies',
];

function newActions(finalConfigForProject = {}) {
  return new GitTagVersionActions(
    { name: 'services-git-tag' },
    {
      name: 'example-go',
      type: 'app',
      data: { root: 'apps/services/example-go' },
    },
    finalConfigForProject,
  );
}

// WHY: a árvore de arquivos do Nx é a fronteira que o formato por manifesto
// usa; como aqui não há manifesto, qualquer acesso a ela é um erro.
function treeThatMustNotBeTouched() {
  return new Proxy(
    {},
    {
      get: (_target, property) =>
        vi.fn(() => {
          throw new Error(
            `a árvore não deveria ser usada: ${String(property)}`,
          );
        }),
    },
  );
}

describe('GitTagVersionActions', () => {
  it('estende o VersionActions do Nx', () => {
    expect(newActions()).toBeInstanceOf(VersionActions);
  });

  it.each(ABSTRACT_MEMBERS)('implementa o membro abstrato %s', (member) => {
    expect(newActions()[member]).toBeTypeOf('function');
  });

  it('não declara nome de manifesto, porque a versão vem da tag git', () => {
    expect(newActions().validManifestFilenames).toBeNull();
  });

  it('valida com o validate herdado do Nx, sem procurar manifesto na árvore', async () => {
    await expect(
      newActions().validate(treeThatMustNotBeTouched()),
    ).resolves.toBeUndefined();
  });

  it('percorre o init e o validate do Nx sem exigir manifesto no projeto', async () => {
    const actions = newActions({ manifestRootsToUpdate: [] });
    const tree = treeThatMustNotBeTouched();

    await actions.init(tree);

    expect(actions.manifestsToUpdate).toEqual([]);
    await expect(actions.validate(tree)).resolves.toBeUndefined();
  });

  it('parte da versão 0.0.0 quando o projeto não tem manifesto', async () => {
    const result = await newActions().readCurrentVersionFromSourceManifest(
      treeThatMustNotBeTouched(),
    );

    expect(result).toEqual({
      currentVersion: '0.0.0',
      manifestPath: 'nenhum (a versão vem da tag git)',
    });
  });

  it('não consulta registry para a versão atual', async () => {
    const result = await newActions().readCurrentVersionFromRegistry(
      treeThatMustNotBeTouched(),
      undefined,
    );

    expect(result).toBeNull();
  });

  it('não lê a versão de dependências, que não existem em manifesto', async () => {
    const result = await newActions().readCurrentVersionOfDependency(
      treeThatMustNotBeTouched(),
      { nodes: {}, dependencies: {} },
      'example-ts',
    );

    expect(result).toEqual({
      currentVersion: null,
      dependencyCollection: null,
    });
  });

  it('não atualiza dependências nem devolve arquivo alterado', async () => {
    const result = await newActions().updateProjectDependencies(
      treeThatMustNotBeTouched(),
      { nodes: {}, dependencies: {} },
      { 'example-ts': '1.2.3' },
    );

    expect(result).toEqual([]);
  });

  it('não grava a nova versão em arquivo, a tag git guarda a versão', async () => {
    const result = await newActions().updateProjectVersion(
      treeThatMustNotBeTouched(),
      '1.2.3',
    );

    expect(result).toEqual([]);
  });
});

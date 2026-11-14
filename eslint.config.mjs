import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';

// WHY: o Biome cobre formatação e as regras de lint de TS, React, Next e
// Playwright. O ESLint fica só com o que o Biome não faz: as fronteiras entre
// projetos do Nx, que dependem do grafo do workspace.
export default [
  ...nx.configs['flat/base'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/test-output',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // NOTE: o parser do typescript-eslint é o que lê TS/TSX e JS moderno.
    languageOptions: { parser: tseslint.parser },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [String.raw`^.*/eslint(\.base)?\.config\.[cm]?[jt]s$`],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
];

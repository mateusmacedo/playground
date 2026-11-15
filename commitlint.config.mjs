import nxScopes from '@commitlint/config-nx-scopes';

const { getProjects } = nxScopes.utils;

// WHY: mudanças fora de qualquer projeto Nx (raiz, CI, dependências) não têm
// um nome de projeto para servir de scope.
const extraScopes = [
  'workspace',
  'ci',
  'deps',
  'release',
  'docs',
  'tooling',
  'infra',
];

// WHY: os projetos da raiz (`@org/source` do pnpm e `playground` do Gradle) são
// cobertos pelo scope `workspace`.
const rootProjects = new Set(['@org/source', 'playground']);

// Verbos imperativos que terminam como o passado ou o gerúndio e não são.
const imperativeAllowlist = new Set([
  'embed',
  'exceed',
  'feed',
  'need',
  'proceed',
  'seed',
  'speed',
  'succeed',
  'bring',
  'swing',
]);

// NOTE: o commitlint não checa modo verbal; é uma heurística sobre a primeira
// palavra (add, não added/adds/adding). Verbos terminados em `ss` ou `us`
// (access, bypass, focus) passam pelo teste do `s` final.
const isImperative = (subject) => {
  const first = subject.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (imperativeAllowlist.has(first)) return true;
  if (/(ed|ing)$/.test(first)) return false;
  return !/[^su]s$/.test(first);
};

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'subject-imperative-mood': ({ subject }) => [
          !subject || isImperative(subject),
          'subject must start with an imperative verb (add, not added/adds/adding)',
        ],
        // NOTE: proxy para "descrição em inglês": acentos e demais caracteres
        // fora do ASCII imprimível indicam texto em português.
        'subject-ascii-only': ({ subject }) => [
          !subject || /^[\x20-\x7E]+$/.test(subject),
          'subject must be English (printable ASCII only)',
        ],
      },
    },
  ],
  rules: {
    'scope-enum': async (ctx) => [
      2,
      'always',
      [
        ...(await getProjects(ctx, ({ name }) => !rootProjects.has(name))),
        ...extraScopes,
      ],
    ],
    'header-max-length': [2, 'always', 120],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-imperative-mood': [2, 'always'],
    'subject-ascii-only': [2, 'always'],
  },
};

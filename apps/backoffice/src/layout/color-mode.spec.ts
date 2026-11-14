import { runInNewContext } from 'node:vm';

import { THEME_STORAGE_KEY, themeBootstrapScript } from './color-mode';

interface Environment {
  readonly stored?: string | null;
  readonly storageBlocked?: boolean;
  readonly systemIsDark?: boolean;
}

/** Roda o script como o navegador roda: com `localStorage`, `matchMedia` e `document` do ambiente, sem o React. */
function appliedTheme({
  stored = null,
  storageBlocked = false,
  systemIsDark = false,
}: Environment): string | undefined {
  const keysRead: string[] = [];
  const dataset: Record<string, string> = {};
  runInNewContext(themeBootstrapScript, {
    localStorage: {
      getItem: (key: string) => {
        keysRead.push(key);
        if (storageBlocked) {
          throw new Error('SecurityError');
        }
        return stored;
      },
    },
    matchMedia: () => ({ matches: systemIsDark }),
    document: { documentElement: { dataset } },
  });
  expect(keysRead).toEqual([THEME_STORAGE_KEY]);
  return dataset.coreuiTheme;
}

describe('themeBootstrapScript', () => {
  it.each<[string, Environment, string]>([
    ['sem escolha salva e sistema claro', { systemIsDark: false }, 'light'],
    ['sem escolha salva e sistema escuro', { systemIsDark: true }, 'dark'],
    ['auto e sistema claro', { stored: 'auto', systemIsDark: false }, 'light'],
    ['auto e sistema escuro', { stored: 'auto', systemIsDark: true }, 'dark'],
    [
      'claro salvo com sistema escuro',
      { stored: 'light', systemIsDark: true },
      'light',
    ],
    [
      'escuro salvo com sistema claro',
      { stored: 'dark', systemIsDark: false },
      'dark',
    ],
    [
      'valor salvo desconhecido e sistema escuro',
      { stored: 'sepia', systemIsDark: true },
      'dark',
    ],
  ])('aplica o tema certo com %s', (_case, environment, expected) => {
    expect(appliedTheme(environment)).toBe(expected);
  });

  it.each<[string, boolean, string]>([
    ['claro', false, 'light'],
    ['escuro', true, 'dark'],
  ])(
    'com o armazenamento bloqueado segue o sistema %s em vez de falhar',
    (_system, systemIsDark, expected) => {
      expect(appliedTheme({ storageBlocked: true, systemIsDark })).toBe(
        expected,
      );
    },
  );
});

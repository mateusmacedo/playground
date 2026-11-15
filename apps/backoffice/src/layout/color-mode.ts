/** Chave do `localStorage` onde o `useColorMode` guarda o tema escolhido. */
export const THEME_STORAGE_KEY = 'backoffice-theme';

/**
 * Aplica o tema salvo antes da primeira pintura, com a mesma regra do `useColorMode`: sem escolha salva ou em
 * `auto`, segue o sistema. Sem isso, a página renderizada no servidor pisca em claro antes de ir para o escuro.
 * Roda no navegador antes do React, por isso é autônomo; o `color-mode.spec.ts` o executa com storage e mídia falsos.
 */
export const themeBootstrapScript = `
(() => {
  let stored = null;
  try {
    stored = localStorage.getItem('${THEME_STORAGE_KEY}');
  } catch {
    // WHY: armazenamento bloqueado não pode impedir o tema do sistema nem quebrar a página.
  }

  let theme = stored;
  if (theme !== 'light' && theme !== 'dark') {
    const systemIsDark = matchMedia('(prefers-color-scheme: dark)').matches;
    theme = systemIsDark ? 'dark' : 'light';
  }
  document.documentElement.dataset.coreuiTheme = theme;
})();
`;

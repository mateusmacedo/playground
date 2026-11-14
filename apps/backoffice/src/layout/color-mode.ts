/** Chave do `localStorage` onde o `useColorModes` do CoreUI guarda o tema escolhido. */
export const THEME_STORAGE_KEY = 'backoffice-theme';

/**
 * Aplica o tema salvo antes da primeira pintura, com a mesma regra do `useColorModes`: sem escolha salva ou em
 * `auto`, segue o sistema. Sem isso, a página renderizada no servidor pisca em claro antes de ir para o escuro.
 */
export const themeBootstrapScript = `(()=>{try{const t=localStorage.getItem('${THEME_STORAGE_KEY}');const d=t==='dark'||((!t||t==='auto')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.coreuiTheme=d?'dark':t||'light';}catch{}})();`;

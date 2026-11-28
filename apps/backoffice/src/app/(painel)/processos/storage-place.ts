export const BROWSER_PLACE = 'neste navegador';
export const SERVER_PLACE = 'no servidor';

/** Onde os processos ficam guardados, para o texto das mensagens: "no servidor" com a API do painel ligada. */
export function storagePlace(remote: boolean): string {
  return remote ? SERVER_PLACE : BROWSER_PLACE;
}

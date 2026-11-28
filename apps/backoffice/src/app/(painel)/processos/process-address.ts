/** Parâmetro do endereço com o processo aberto (`/processos?processo=process-2`), usado no link que vem do quadro. */
export const PROCESS_PARAM = 'processo';

/** Id do processo pedido no endereço da página; `null` quando o endereço não pede nenhum. */
export function readRequestedProcess(): string | null {
  const requested = new URLSearchParams(window.location.search).get(
    PROCESS_PARAM,
  );
  return requested === null || requested === '' ? null : requested;
}

/** Põe o processo aberto no endereço, sem recarregar a página nem criar entrada nova no histórico. */
export function writeProcessAddress(definitionId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(PROCESS_PARAM, definitionId);
  if (url.href === window.location.href) {
    return;
  }
  // WHY: o Next integra o `replaceState` nativo ao roteador; o endereço muda sem recarregar nem criar entrada nova
  // no histórico do navegador.
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );
}

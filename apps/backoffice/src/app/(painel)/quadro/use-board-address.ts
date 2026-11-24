import { useEffect } from 'react';

const BOARD_PARAM = 'quadro';

/** Id do quadro pedido no endereço da página, ou `null` quando o endereço não pede nenhum. */
export function readRequestedBoard(): string | null {
  return new URLSearchParams(window.location.search).get(BOARD_PARAM);
}

export interface UseBoardAddressParams {
  /** A lista de quadros gravada já foi lida; antes disso o endereço não é tocado. */
  readonly ready: boolean;
  /** Quadro aberto agora. */
  readonly boardId: string;
}

/** Mantém o quadro aberto no endereço (`?quadro=<id>`), para o link copiado de um card abrir no quadro certo. */
export function useBoardAddress(params: UseBoardAddressParams): void {
  const { ready, boardId } = params;

  useEffect(() => {
    if (!ready) {
      return;
    }
    const url = new URL(window.location.href);
    const boardInAddress = url.searchParams.get(BOARD_PARAM);
    if (boardInAddress === boardId) {
      return;
    }
    url.searchParams.set(BOARD_PARAM, boardId);
    // NOTE: o card do endereço é de outro quadro só quando o endereço já apontava para um quadro.
    if (boardInAddress !== null) {
      url.searchParams.delete('card');
    }
    // WHY: o Next integra o `replaceState` nativo ao roteador; o endereço muda sem recarregar nem criar entrada nova.
    window.history.replaceState(window.history.state, '', url.href);
  }, [ready, boardId]);
}

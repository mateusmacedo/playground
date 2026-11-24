import { useEffect, useEffectEvent, useState } from 'react';

import type { Board } from './model/board';
import { findByKey } from './model/card-key';

const CARD_PARAM = 'card';

/**
 * Liga o card aberto ao endereço (`?card=QD-12`): abrir o endereço abre o card, e abrir ou fechar o card atualiza o
 * endereço sem recarregar a página. A leitura espera `ready`, porque o card pode estar só no quadro gravado.
 */
export function useCardUrl(params: {
  readonly ready: boolean;
  readonly board: Board;
  /** Código do card aberto no painel, ou `undefined`. */
  readonly openKey: string | undefined;
  readonly onOpen: (cardId: string) => void;
  /** Abre o card arquivado só para leitura; sem ela, o arquivado conta como indisponível. */
  readonly onOpenArchived?: (cardId: string) => void;
  /** O endereço pediu um card que não pode ser aberto; recebe a mensagem para a tela. */
  readonly onUnavailable: (message: string) => void;
}): void {
  const { ready, openKey } = params;
  const [checked, setChecked] = useState(false);

  const readAddress = useEffectEvent(() => {
    setChecked(true);
    const key = new URLSearchParams(window.location.search).get(CARD_PARAM);
    if (!key) {
      return;
    }
    const found = findByKey({ board: params.board, key });
    if (found.kind === 'live') {
      params.onOpen(found.cardId);
      return;
    }
    if (found.kind === 'archived' && params.onOpenArchived) {
      params.onOpenArchived(found.cardId);
      return;
    }
    params.onUnavailable(
      found.kind === 'archived'
        ? `O card ${key.toUpperCase()} está arquivado. Restaure-o em "Arquivados" para abrir.`
        : `O card ${key} não existe neste quadro.`,
    );
  });

  useEffect(() => {
    if (ready && !checked) {
      readAddress();
    }
  }, [ready, checked]);

  useEffect(() => {
    if (!checked) {
      return;
    }
    const url = new URL(window.location.href);
    if (openKey) {
      url.searchParams.set(CARD_PARAM, openKey);
    } else {
      url.searchParams.delete(CARD_PARAM);
    }
    if (url.href !== window.location.href) {
      // WHY: o Next integra o `replaceState` nativo ao roteador; o endereço muda sem recarregar nem criar entrada nova
      // no histórico do navegador.
      window.history.replaceState(
        null,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [checked, openKey]);
}

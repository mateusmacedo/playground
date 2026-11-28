import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePanelApi } from '@/shared/api/panel-api-context';
import { useReloadOnFocus } from '@/shared/hooks/use-reload-on-focus';
import { createHttpBoardRunsSource } from '@/shared/process/board-runs-http';
import {
  type BoardRunsReading,
  createBrowserBoardRunsSource,
} from '@/shared/process/board-runs-source';

/** O que a tela sabe das execuções em andamento. */
export type BoardRunsState =
  /** A leitura ainda não terminou: primeira renderização, igual à do servidor, ou nova tentativa. */
  { readonly kind: 'pending' } | BoardRunsReading;

export interface BoardRunsAccess {
  readonly reading: BoardRunsState;
  /** Lê de novo, trocando a tela pelo carregamento: depois de uma falha ou de uma lista incompleta. */
  readonly retry: () => void;
}

const PENDING: BoardRunsState = { kind: 'pending' };

interface LoadParams {
  /** Releitura de quem já está vendo a lista: não troca a tela pelo carregamento nem pela falha. */
  readonly silent: boolean;
}

/**
 * Execuções em andamento de todos os quadros. Com a API do painel, vêm dela e são relidas quando a pessoa volta para
 * a aba; sem a API, vêm do que o quadro gravou neste navegador. A leitura acontece depois de montar, no navegador,
 * para a rota continuar estática.
 */
export function useBoardRuns(): BoardRunsAccess {
  const api = usePanelApi();
  const source = useMemo(
    () =>
      api === null
        ? createBrowserBoardRunsSource()
        : createHttpBoardRunsSource(api.boards),
    [api],
  );
  const [reading, setReading] = useState<BoardRunsState>(PENDING);
  /** Número do pedido mais recente; a resposta de um pedido anterior é descartada. */
  const latestRequest = useRef(0);

  const load = useCallback(
    async (params: LoadParams) => {
      latestRequest.current += 1;
      const request = latestRequest.current;
      if (!params.silent) {
        setReading(PENDING);
      }
      const result = await source.load(new Date().toISOString());
      if (request !== latestRequest.current) {
        return;
      }
      if (params.silent && result.kind === 'failed') {
        return;
      }
      setReading(result);
    },
    [source],
  );

  useEffect(() => {
    // NOTE: o Next mantém a rota anterior montada e escondida, sem os efeitos. Este roda de novo quando ela volta a
    // aparecer, e é aqui que a lista alcança o que mudou no quadro enquanto ela estava escondida.
    void load({ silent: false });
  }, [load]);

  useReloadOnFocus({
    reload: () => {
      void load({ silent: true });
    },
    // NOTE: sem a API, o que o quadro grava fica neste navegador e a lista o lê ao abrir. Com uma leitura a caminho,
    // a volta do foco não pede outra: a silenciosa que falhasse deixaria a tela no carregamento para sempre.
    enabled: api !== null && reading.kind !== 'pending',
  });

  return {
    reading,
    retry: () => {
      void load({ silent: false });
    },
  };
}

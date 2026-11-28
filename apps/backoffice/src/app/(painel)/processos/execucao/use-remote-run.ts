import { useCallback, useEffect, useRef, useState } from 'react';

import type { PanelApi } from '@/shared/api/panel-api';
import { useReloadOnFocus } from '@/shared/hooks/use-reload-on-focus';
import {
  loadRemoteRunView,
  type RemoteRunView,
} from '@/shared/process/run-view-http';
import { parseRunViewRef } from '@/shared/process/run-view-store';

import { REF_PARAM } from './use-run-view';

/** O que o endereço e a API dizem sobre a execução pedida. */
export type RemoteRunReading =
  /** O endereço ainda não foi lido ou a API ainda não respondeu. */
  | { readonly kind: 'pending' }
  /** O endereço não traz a referência de uma execução. */
  | { readonly kind: 'no-ref' }
  | RemoteRunView;

export interface RemoteRun {
  readonly reading: RemoteRunReading;
  /** Lê de novo, depois de uma leitura que falhou. */
  readonly retry: () => void;
}

const PENDING: RemoteRunReading = { kind: 'pending' };

interface LoadParams {
  /** Releitura de quem já está vendo a situação: não troca a tela pelo carregamento nem pela falha. */
  readonly silent: boolean;
}

/**
 * Situação da execução pedida no endereço, lida da API do painel. A leitura acontece depois de montar, no navegador,
 * para a rota continuar estática, e de novo quando a pessoa volta para a aba, para a situação não ficar velha.
 */
export function useRemoteRun(api: PanelApi): RemoteRun {
  const [reading, setReading] = useState<RemoteRunReading>(PENDING);
  /** Número do pedido mais recente; a resposta de um pedido anterior é descartada. */
  const latestRequest = useRef(0);

  const load = useCallback(
    async (params: LoadParams) => {
      const address = new URLSearchParams(window.location.search);
      const ref = parseRunViewRef(address.get(REF_PARAM));
      latestRequest.current += 1;
      const request = latestRequest.current;
      if (ref === null) {
        setReading({ kind: 'no-ref' });
        return;
      }
      if (!params.silent) {
        setReading(PENDING);
      }
      const result = await loadRemoteRunView({
        api,
        ref,
        at: new Date().toISOString(),
      });
      if (request !== latestRequest.current) {
        return;
      }
      if (params.silent && result.kind === 'failed') {
        return;
      }
      setReading(result);
    },
    [api],
  );

  useEffect(() => {
    // NOTE: o Next mantém a rota anterior montada e escondida, sem os efeitos. Este roda de novo quando ela volta a
    // aparecer, e é aqui que ela lê a referência do novo endereço.
    void load({ silent: false });
  }, [load]);

  useReloadOnFocus({
    reload: () => {
      void load({ silent: true });
    },
    // NOTE: com uma leitura a caminho, a volta do foco não pede outra: a silenciosa que falhasse deixaria a tela no
    // carregamento para sempre.
    enabled: reading.kind !== 'pending',
  });

  return {
    reading,
    retry: () => {
      void load({ silent: false });
    },
  };
}

import { useEffect, useEffectEvent, useState } from 'react';

import type { RunView, RunViewStore } from '@/shared/process/run-view-store';

/** Parâmetro do endereço com a referência da execução: `?ref=<id do quadro>:<id do card>`. */
export const REF_PARAM = 'ref';

/** O que o endereço e o armazenamento dizem sobre a execução pedida. */
export type RunViewReading =
  /** O endereço ainda não foi lido: primeira renderização, igual à do servidor. */
  | { readonly kind: 'pending' }
  /** O endereço não traz a referência de uma execução. */
  | { readonly kind: 'no-ref' }
  /** A execução pedida não tem situação gravada neste navegador. */
  | { readonly kind: 'no-view' }
  | { readonly kind: 'ready'; readonly view: RunView };

const PENDING: RunViewReading = { kind: 'pending' };

/**
 * Situação da execução pedida no endereço. A leitura acontece depois de montar, no navegador, para a rota continuar
 * estática: o servidor não conhece o endereço completo nem o que o navegador guarda.
 */
export function useRunView(store: RunViewStore): RunViewReading {
  const [reading, setReading] = useState<RunViewReading>(PENDING);

  const readAddress = useEffectEvent(() => {
    const ref = new URLSearchParams(window.location.search).get(REF_PARAM);
    if (!ref) {
      setReading({ kind: 'no-ref' });
      return;
    }
    const view = store.load(ref);
    setReading(view === null ? { kind: 'no-view' } : { kind: 'ready', view });
  });

  useEffect(() => {
    // NOTE: o Next mantém a rota anterior montada e escondida, sem os efeitos. Este roda de novo quando ela volta a
    // aparecer, e é aqui que ela lê a referência do novo endereço e a situação que o quadro acabou de gravar.
    readAddress();
  }, []);

  return reading;
}

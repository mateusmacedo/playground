'use client';

import { usePanelApi } from '@/shared/api/panel-api-context';

/** Diz, ao lado do título, onde os dados do quadro ficam: no navegador, enquanto o painel não tem a API ligada. */
export function StorageHint() {
  const api = usePanelApi();
  return (
    <span className="small text-body-secondary">
      {api
        ? 'Em teste: pode mudar.'
        : 'Em teste: pode mudar, e os dados ficam só neste navegador.'}
    </span>
  );
}

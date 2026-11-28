import { usePanelApi } from '@/shared/api/panel-api-context';

import { storagePlace } from './storage-place';

/** Onde os processos desta tela ficam guardados, para o texto das mensagens. */
export function useStoragePlace(): string {
  return storagePlace(usePanelApi() !== null);
}

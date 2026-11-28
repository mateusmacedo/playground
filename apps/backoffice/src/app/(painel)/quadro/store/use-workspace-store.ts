import { useState } from 'react';

import { usePanelApi } from '@/shared/api/panel-api-context';

import type { Board } from '../model/board';
import { createBrowserWorkspaceStore } from './browser-workspace-store';
import { createHttpWorkspaceStore } from './http-workspace-store';
import type { WorkspaceStore } from './workspace-store';

export interface UseWorkspaceStoreParams {
  /** Conteúdo do quadro padrão, que a API recebe quando ainda não tem nenhum quadro. */
  readonly defaultContent: () => Board;
}

/**
 * Onde os quadros desta tela ficam: na API do painel, quando ela está ligada, ou no navegador. A escolha é feita uma
 * vez, ao montar, e o mesmo armazenamento vale enquanto a tela existir.
 */
export function useWorkspaceStore(
  params: UseWorkspaceStoreParams,
): WorkspaceStore {
  const api = usePanelApi();
  const [store] = useState<WorkspaceStore>(() =>
    api
      ? createHttpWorkspaceStore({
          api: api.boards,
          defaultContent: params.defaultContent,
        })
      : createBrowserWorkspaceStore(),
  );
  return store;
}

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { usePanelApi } from '@/shared/api/panel-api-context';

import { createHttpCatalogStore } from './catalog-http-store';
import { createCatalogSession } from './catalog-session';
import type {
  CatalogRefreshed,
  CatalogSession,
  CatalogSnapshot,
} from './catalog-session-contract';
import { type CatalogStore, createBrowserCatalogStore } from './catalog-store';

/** O catálogo de processos para uma tela: o que mostrar e como mudar, reler e resolver a gravação que não foi feita. */
export interface ProcessCatalogAccess
  extends CatalogSnapshot,
    Pick<
      CatalogSession,
      'update' | 'commit' | 'reload' | 'refresh' | 'retrySave' | 'keepMine'
    > {}

export interface ProcessCatalogOptions {
  /** Com `true`, a releitura automática não acontece: a tela tem algo que a releitura deixaria para trás. */
  readonly holdRefresh?: () => boolean;
  /** Chamada depois que uma releitura automática trocou o catálogo da tela. */
  readonly onRefreshed?: (change: CatalogRefreshed) => void;
}

const BROWSER_STORE = createBrowserCatalogStore();

/**
 * Catálogo de processos, guardado na API do painel ou, sem ela, no navegador. A leitura acontece depois de montar, para
 * a primeira renderização ser igual à do servidor, e de novo quando a rota escondida reaparece. O catálogo acompanha o
 * que as outras telas e as outras abas gravam no navegador. Falha de leitura, falha de gravação e conflito viram
 * estado (`loadFailure`, `storageFailed`, `conflict`), nunca exceção.
 */
export function useProcessCatalog(
  store?: CatalogStore,
  options?: ProcessCatalogOptions,
): ProcessCatalogAccess {
  const api = usePanelApi();
  const active = useMemo(() => {
    if (store !== undefined) {
      return store;
    }
    return api === null
      ? BROWSER_STORE
      : createHttpCatalogStore(api.processDefinitions);
  }, [store, api]);

  /** As opções da renderização mais recente, para a sessão não ficar com as da primeira. */
  const latestOptions = useRef(options);
  useEffect(() => {
    latestOptions.current = options;
  });

  const session = useMemo(
    () =>
      createCatalogSession({
        store: active,
        holdRefresh: () => latestOptions.current?.holdRefresh?.() ?? false,
        onRefreshed: (change) => latestOptions.current?.onRefreshed?.(change),
      }),
    [active],
  );
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  useEffect(() => {
    // NOTE: o Next mantém a rota anterior montada e escondida, sem os efeitos. Este roda de novo quando ela volta a
    // aparecer, e é aqui que ela lê o que outra rota gravou nesse intervalo.
    session.start();
    return active.subscribe(session.adopt);
  }, [active, session]);

  return useMemo(
    () => ({
      ...snapshot,
      update: session.update,
      commit: session.commit,
      reload: session.reload,
      refresh: session.refresh,
      retrySave: session.retrySave,
      keepMine: session.keepMine,
    }),
    [snapshot, session],
  );
}

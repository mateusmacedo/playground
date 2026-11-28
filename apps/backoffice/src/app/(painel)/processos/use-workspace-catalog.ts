import type { RefObject } from 'react';

import { useReloadOnFocus } from '@/shared/hooks/use-reload-on-focus';
import type { ProcessCatalog } from '@/shared/process/catalog';
import type { CatalogRefreshed } from '@/shared/process/catalog-session-contract';
import type { CatalogStore } from '@/shared/process/catalog-store';
import {
  type ProcessCatalogAccess,
  useProcessCatalog,
} from '@/shared/process/use-process-catalog';

import { draftOpeningText } from './catalog-draft-store';
import { liveDefinitions, openDefinition } from './open-process';
import type { EditorGuard } from './process-editor';

export interface UseWorkspaceCatalogParams {
  readonly catalogStore: CatalogStore;
  /** O catálogo fica na API do painel, que não avisa o que outro lugar gravou: a tela relê ao voltar o foco. */
  readonly remote: boolean;
  /** O processo aberto já foi escolhido. */
  readonly ready: boolean;
  readonly activeId: string | null;
  readonly guardRef: RefObject<EditorGuard | null>;
  /** Troca o processo aberto; `null` quando não sobra nenhum para abrir. */
  readonly onOpen: (definitionId: string | null) => void;
  /** Reabre o editor com o desenho que está no catálogo. */
  readonly onRemount: () => void;
  readonly showNotice: (message: string) => void;
}

export interface WorkspaceCatalog {
  readonly access: ProcessCatalogAccess;
  /** Recarrega o catálogo e reabre o editor com o que está gravado, descartando o que a tela tinha e não gravou. */
  readonly reloadFromServer: () => Promise<void>;
  /** No conflito, grava a versão desta tela por cima da que foi gravada em outro lugar. */
  readonly keepMine: () => Promise<void>;
}

/**
 * O catálogo da página de processos e o que acontece com o editor quando o catálogo é relido: o processo aberto
 * continua aberto enquanto existir, e o editor reabre quando o desenho dele mudou em outro lugar.
 */
export function useWorkspaceCatalog(
  params: UseWorkspaceCatalogParams,
): WorkspaceCatalog {
  const { catalogStore, remote, ready, activeId, guardRef } = params;

  /**
   * Mantém aberto o processo que estava aberto ou, se ele saiu da lista, abre o primeiro dela. Devolve o id do que
   * continuou aberto; `null` quando o aberto mudou ou não há nenhum.
   */
  function keepOpen(next: ProcessCatalog): string | null {
    const opened = openDefinition({
      live: liveDefinitions(next),
      candidates: [activeId],
    });
    const openedId = opened?.id ?? null;
    params.onOpen(openedId);
    return openedId === activeId ? openedId : null;
  }

  function followRefresh(change: CatalogRefreshed) {
    const definitionId = keepOpen(change.after);
    if (definitionId === null) {
      return;
    }
    const before = draftOpeningText({ catalog: change.before, definitionId });
    const after = draftOpeningText({ catalog: change.after, definitionId });
    if (before !== after) {
      params.onRemount();
    }
  }

  // NOTE: a releitura automática só existe com a API. Com alteração não salva no editor ela não acontece: a revisão
  // lida continua a do desenho que está no canvas, e o que mudou em outro lugar aparece como conflito ao salvar.
  const access = useProcessCatalog(
    catalogStore,
    remote
      ? {
          holdRefresh: () => guardRef.current?.hasChanges ?? false,
          onRefreshed: followRefresh,
        }
      : undefined,
  );
  const { refresh } = access;
  useReloadOnFocus({
    reload: () => {
      void refresh();
    },
    enabled: remote && ready,
  });

  async function reloadFromServer() {
    const reloaded = await access.reload();
    // NOTE: quando a leitura falha, o catálogo da tela e o conflito ficam como estavam; o motivo vira aviso.
    if (reloaded === null) {
      return;
    }
    keepOpen(reloaded);
    params.onRemount();
  }

  async function keepMine() {
    const kept = await access.keepMine();
    if (!kept) {
      params.showNotice('A sua versão não pôde ser gravada. Tente de novo.');
    }
  }

  return { access, reloadFromServer, keepMine };
}

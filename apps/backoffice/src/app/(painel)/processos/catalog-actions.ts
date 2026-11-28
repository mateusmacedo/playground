import type {
  CatalogResult,
  ProcessCatalog,
  ProcessVersion,
} from '@/shared/process/catalog';
import {
  archiveDefinition,
  createDefinition,
  describeDefinition,
  duplicateDefinition,
  renameDefinition,
  restoreDefinition,
  saveDraft,
} from '@/shared/process/catalog-changes';

import { neighborDefinition } from './open-process';
import type { ProcessWorkspace } from './use-process-workspace';

export interface CatalogActions {
  /** Cria o processo e abre, depois de confirmar a troca quando o rascunho aberto tem alteração não salva. */
  readonly create: (name: string) => void;
  readonly rename: (name: string) => void;
  readonly describe: (description: string) => void;
  /** Duplica o processo aberto e abre a cópia. */
  readonly duplicate: () => void;
  /** Arquiva o processo aberto e abre o vizinho dele na lista. */
  readonly archive: () => void;
  readonly restore: (definitionId: string) => void;
  /** Substitui o rascunho do processo aberto pelo desenho da versão e reabre o editor. */
  readonly openVersion: (version: ProcessVersion) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** O que as ações usam da página de processos. */
export type CatalogActionsWorkspace = Pick<
  ProcessWorkspace,
  | 'active'
  | 'live'
  | 'openProcess'
  | 'requestGuarded'
  | 'showNotice'
  | 'remount'
> & {
  readonly access: Pick<ProcessWorkspace['access'], 'update'>;
};

/** As ações do seletor de processos sobre o catálogo; recusa inesperada (outra aba mudou o catálogo) vira aviso. */
export function createCatalogActions(
  workspace: CatalogActionsWorkspace,
): CatalogActions {
  const { access, active, live, openProcess, requestGuarded, showNotice } =
    workspace;
  const { update } = access;
  const activeId = active?.id;

  function apply(change: (catalog: ProcessCatalog) => CatalogResult) {
    const result = update(change);
    if (!result.ok) {
      showNotice(result.refusal.message);
    }
    return result.ok;
  }

  function create(name: string) {
    requestGuarded(() => {
      const result = update((catalog) =>
        createDefinition({ catalog, name, at: nowIso() }),
      );
      if (result.ok) {
        openProcess(result.definitionId);
      } else {
        showNotice(result.refusal.message);
      }
    });
  }

  function duplicate() {
    if (activeId === undefined) {
      return;
    }
    requestGuarded(() => {
      const result = update((catalog) =>
        duplicateDefinition({ catalog, definitionId: activeId, at: nowIso() }),
      );
      if (result.ok) {
        openProcess(result.definitionId);
      } else {
        showNotice(result.refusal.message);
      }
    });
  }

  function archive() {
    if (activeId === undefined) {
      return;
    }
    const neighbor = neighborDefinition({ live, definitionId: activeId });
    requestGuarded(() => {
      const archived = apply((catalog) =>
        archiveDefinition({ catalog, definitionId: activeId, at: nowIso() }),
      );
      if (archived && neighbor !== undefined) {
        openProcess(neighbor.id);
      }
    });
  }

  function onActive(
    change: (params: {
      readonly catalog: ProcessCatalog;
      readonly definitionId: string;
      readonly at: string;
    }) => CatalogResult,
  ) {
    if (activeId === undefined) {
      return false;
    }
    return apply((catalog) =>
      change({ catalog, definitionId: activeId, at: nowIso() }),
    );
  }

  return {
    create,
    rename: (name) => {
      onActive((params) => renameDefinition({ ...params, name }));
    },
    describe: (description) => {
      onActive((params) => describeDefinition({ ...params, description }));
    },
    duplicate,
    archive,
    restore: (definitionId) => {
      apply((catalog) =>
        restoreDefinition({ catalog, definitionId, at: nowIso() }),
      );
    },
    openVersion: (version) => {
      const saved = onActive((params) =>
        saveDraft({ ...params, text: version.documentText }),
      );
      if (saved) {
        workspace.remount();
      }
    },
  };
}

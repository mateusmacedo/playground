'use client';

import { useMemo, useState } from 'react';

import { usePanelApi } from '@/shared/api/panel-api-context';
import { latestVersion } from '@/shared/process/catalog';
import { createHttpCatalogStore } from '@/shared/process/catalog-http-store';
import {
  type CatalogStore,
  createBrowserCatalogStore,
} from '@/shared/process/catalog-store';
import { ErrorState } from '@/shared/ui/states';

import {
  type ActiveProcessStore,
  createSessionActiveProcessStore,
} from './active-process-store';
import { createCatalogActions } from './catalog-actions';
import { type CatalogDialog, CatalogDialogs } from './catalog-dialogs';
import { createCatalogDraftStore } from './catalog-draft-store';
import { createBrowserDraftStore, type DraftStore } from './draft-store';
import type { Graph } from './model/blocks';
import { ProcessEditor } from './process-editor';
import { ProcessSwitcher } from './process-switcher';
import { type EditorPublication, publishDraft } from './publication';
import {
  useProcessWorkspace,
  type ProcessWorkspace as Workspace,
} from './use-process-workspace';
import { WorkspaceNotices } from './workspace-notices';

export interface ProcessWorkspaceProps {
  /** Desenho do processo de exemplo, aberto em processo sem rascunho e publicado na primeira carga. */
  readonly sample: Graph;
  /** Onde o catálogo é guardado; por padrão, a API do painel ou, sem ela, o `localStorage` do navegador. */
  readonly catalogStore?: CatalogStore;
  /** Rascunho da versão anterior do editor, levado para o catálogo na primeira carga. */
  readonly legacyStore?: DraftStore;
  /** Processo aberto por último nesta aba; por padrão, o `sessionStorage`. */
  readonly activeStore?: ActiveProcessStore;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface OpenProcessProps {
  readonly workspace: Workspace;
  readonly sample: Graph;
  readonly onShowVersions: () => void;
}

/** O editor do processo aberto, remontado a cada troca de processo e a cada rascunho substituído por uma versão. */
function OpenProcess({
  workspace,
  sample,
  onShowVersions,
}: Readonly<OpenProcessProps>) {
  const { active, current, generation } = workspace;
  const { commit } = workspace.access;
  const definitionId = active?.id;
  const draftStore = useMemo(
    () =>
      definitionId === undefined
        ? undefined
        : createCatalogDraftStore({
            definitionId,
            current,
            commit,
            now: nowIso,
          }),
    [definitionId, current, commit],
  );
  if (active === undefined || draftStore === undefined) {
    return (
      <p className="text-body-secondary">
        Nenhum processo aberto. Crie um processo novo ou restaure um em
        Arquivados.
      </p>
    );
  }
  const publication: EditorPublication = {
    latest: latestVersion(active),
    versionCount: active.versions.length,
    publish: (request) =>
      publishDraft({
        ...request,
        commit,
        definitionId: active.id,
        at: nowIso(),
      }),
    onShowVersions,
  };
  return (
    <ProcessEditor
      key={`${active.id}:${generation}`}
      initial={sample}
      store={draftStore}
      publication={publication}
      guardRef={workspace.guardRef}
    />
  );
}

interface WorkspaceOpeningProps {
  readonly workspace: Workspace;
}

/** Antes de o editor abrir: o catálogo ainda está sendo lido ou a leitura falhou e pode ser tentada de novo. */
function WorkspaceOpening({ workspace }: Readonly<WorkspaceOpeningProps>) {
  const { loadFailure, reload } = workspace.access;
  if (loadFailure !== null) {
    return (
      <ErrorState
        message="Não foi possível carregar os processos."
        detail={loadFailure.message}
        onRetry={() => {
          void reload();
        }}
      />
    );
  }
  return (
    <p role="status" className="small text-body-secondary">
      Carregando o editor…
    </p>
  );
}

/**
 * Página do editor com o catálogo: o seletor do processo aberto, as ações do catálogo e o editor do processo. O
 * catálogo vem da API do painel ou do navegador, então tudo é lido depois de montar.
 */
export function ProcessWorkspace({
  sample,
  catalogStore,
  legacyStore,
  activeStore,
}: Readonly<ProcessWorkspaceProps>) {
  const api = usePanelApi();
  const [stores] = useState(() => ({
    catalogStore:
      catalogStore ??
      (api === null
        ? createBrowserCatalogStore()
        : createHttpCatalogStore(api.processDefinitions)),
    legacyStore: legacyStore ?? createBrowserDraftStore(),
    activeStore: activeStore ?? createSessionActiveProcessStore(),
  }));
  const workspace = useProcessWorkspace({
    ...stores,
    sample,
    remote: api !== null,
  });
  const actions = createCatalogActions(workspace);
  const [dialog, setDialog] = useState<CatalogDialog | null>(null);
  if (!workspace.ready) {
    return <WorkspaceOpening workspace={workspace} />;
  }
  return (
    <>
      <ProcessSwitcher
        live={workspace.live}
        active={workspace.active}
        archivedCount={workspace.archived.length}
        onSelect={workspace.requestOpen}
        onDuplicate={actions.duplicate}
        onOpenDialog={(kind) => setDialog({ kind })}
      />
      <WorkspaceNotices workspace={workspace} />
      <OpenProcess
        workspace={workspace}
        sample={sample}
        onShowVersions={() => setDialog({ kind: 'versions' })}
      />
      <CatalogDialogs
        workspace={workspace}
        actions={actions}
        dialog={dialog}
        onDialog={setDialog}
      />
    </>
  );
}

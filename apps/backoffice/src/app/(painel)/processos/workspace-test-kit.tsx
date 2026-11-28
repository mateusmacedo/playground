import { render, screen, within } from '@testing-library/react';

import { PanelApiProvider } from '@/shared/api/panel-api-context';
import { fakeBoardsApi } from '@/shared/process/boards-api-fake';
import type { ProcessCatalog } from '@/shared/process/catalog';
import {
  type FakeDefinitionsApi,
  fakeDefinitionsApi,
} from '@/shared/process/definitions-api-fake';

import type { ActiveProcessStore } from './active-process-store';
import { seedCatalog } from './catalog-seed';
import {
  type MemoryCatalogStore,
  memoryCatalogStore,
} from './catalog-test-store';
import type { DraftStore } from './draft-store';
import type { Graph } from './model/blocks';
import { DOCUMENT_VERSION } from './model/document';
import { serializeDocument } from './model/draft';
import { sampleProcess } from './model/sample-process';
import { ProcessWorkspace } from './process-workspace';

/** O exemplo com outro nome na etapa, para distinguir os dois processos no canvas. */
export const purchaseGraph: Graph = {
  ...sampleProcess,
  nodes: sampleProcess.nodes.map((node) =>
    node.id === 'task-1'
      ? { ...node, data: { ...node.data, label: 'Etapa de compras' } }
      : node,
  ),
};

export function documentText(graph: Graph): string {
  return serializeDocument({ version: DOCUMENT_VERSION, lanes: [], graph });
}

/** Catálogo com "Meu processo" (`process-1`, só rascunho, a etapa de compras) e o exemplo publicado (`process-2`). */
export function twoProcessCatalog(): ProcessCatalog {
  return seedCatalog({
    catalog: { definitions: [] },
    legacyDraft: documentText(purchaseGraph),
    sample: sampleProcess,
    at: '2026-11-20T10:00:00.000Z',
  }).catalog;
}

export interface WorkspaceSetup {
  readonly catalog?: ProcessCatalog | null;
  readonly legacy?: string | null;
  readonly lastActive?: string | null;
  readonly url?: string;
  /** Espera o editor montar; `false` quando não há processo para abrir. */
  readonly withEditor?: boolean;
}

export interface RenderedWorkspace {
  readonly catalogStore: MemoryCatalogStore;
  readonly lastActive: () => string | null;
}

export async function renderWorkspace(
  setup: WorkspaceSetup = {},
): Promise<RenderedWorkspace> {
  const catalogStore = memoryCatalogStore(setup.catalog ?? null);
  const legacyStore: DraftStore = {
    load: () => setup.legacy ?? null,
    save: async () => undefined,
  };
  let lastActive = setup.lastActive ?? null;
  const activeStore: ActiveProcessStore = {
    load: () => lastActive,
    save: (definitionId) => {
      lastActive = definitionId;
    },
  };
  window.history.replaceState(null, '', setup.url ?? '/processos');
  render(
    <ProcessWorkspace
      sample={sampleProcess}
      catalogStore={catalogStore}
      legacyStore={legacyStore}
      activeStore={activeStore}
    />,
  );
  await screen.findByLabelText('Processo');
  if (setup.withEditor !== false) {
    await screen.findByLabelText('Canvas do processo');
  }
  return { catalogStore, lastActive: () => lastActive };
}

export interface RemoteWorkspaceSetup {
  /** A API simulada; sem ela, uma com os dois processos de `twoProcessCatalog`. */
  readonly api?: FakeDefinitionsApi;
  readonly url?: string;
  /** Espera o seletor de processos aparecer; `false` quando a leitura do catálogo vai falhar. */
  readonly waitReady?: boolean;
  /** Espera o editor montar; `false` quando não há processo para abrir. */
  readonly withEditor?: boolean;
}

export interface RenderedRemoteWorkspace {
  readonly api: FakeDefinitionsApi;
}

/** A página de processos com a API do painel ligada, sobre a API simulada. */
export async function renderRemoteWorkspace(
  setup: RemoteWorkspaceSetup = {},
): Promise<RenderedRemoteWorkspace> {
  const api = setup.api ?? fakeDefinitionsApi(twoProcessCatalog().definitions);
  let lastActive: string | null = null;
  const activeStore: ActiveProcessStore = {
    load: () => lastActive,
    save: (definitionId) => {
      lastActive = definitionId;
    },
  };
  // NOTE: o rascunho antigo existe de propósito: com a API, ele não pode virar processo.
  const legacyStore: DraftStore = {
    load: () => documentText(purchaseGraph),
    save: async () => undefined,
  };
  window.history.replaceState(null, '', setup.url ?? '/processos');
  render(
    <PanelApiProvider
      value={{ boards: fakeBoardsApi(), processDefinitions: api }}
    >
      <ProcessWorkspace
        sample={sampleProcess}
        legacyStore={legacyStore}
        activeStore={activeStore}
      />
    </PanelApiProvider>,
  );
  if (setup.waitReady === false) {
    return { api };
  }
  await screen.findByLabelText('Processo');
  if (setup.withEditor !== false) {
    await screen.findByLabelText('Canvas do processo');
  }
  return { api };
}

export function canvas() {
  return screen.getByLabelText('Canvas do processo');
}

export function processSelect() {
  return screen.getByLabelText('Processo') as HTMLSelectElement;
}

export function draftStatus() {
  return screen.getByText(/rascunho|Alterações|Salvando/i, {
    selector: '[role="status"]',
  }).textContent;
}

export async function findCanvasText(text: string) {
  return within(canvas()).findByText(text);
}

export function button(name: string) {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

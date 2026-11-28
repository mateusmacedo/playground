import {
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

import {
  type CatalogChanged,
  findDefinition,
  type ProcessCatalog,
  type ProcessDefinition,
} from '@/shared/process/catalog';
import type { CatalogStore } from '@/shared/process/catalog-store';
import type { ProcessCatalogAccess } from '@/shared/process/use-process-catalog';

import type { ActiveProcessStore } from './active-process-store';
import { seedCatalog } from './catalog-seed';
import type { DraftStore } from './draft-store';
import type { Graph } from './model/blocks';
import {
  liveDefinitions,
  openDefinition,
  resolveAddressRequest,
} from './open-process';
import { readRequestedProcess, writeProcessAddress } from './process-address';
import type { EditorGuard } from './process-editor';
import { storagePlace } from './storage-place';
import { useWorkspaceCatalog } from './use-workspace-catalog';

export interface UseProcessWorkspaceParams {
  readonly catalogStore: CatalogStore;
  /** Rascunho que o editor gravava antes do catálogo, levado para ele na primeira carga. */
  readonly legacyStore: DraftStore;
  readonly activeStore: ActiveProcessStore;
  /** Desenho do processo de exemplo. */
  readonly sample: Graph;
  /**
   * O catálogo fica na API do painel: não há primeira carga (o exemplo vem dos dados do servidor), e a tela relê o
   * catálogo quando a pessoa volta para a aba.
   */
  readonly remote: boolean;
}

interface PendingAction {
  readonly run: () => void;
}

export interface ProcessWorkspace {
  readonly access: ProcessCatalogAccess;
  /** O catálogo foi lido, a primeira carga foi feita e o processo aberto foi escolhido. */
  readonly ready: boolean;
  readonly active: ProcessDefinition | undefined;
  /** Processos não arquivados, na ordem do catálogo. */
  readonly live: readonly ProcessDefinition[];
  readonly archived: readonly ProcessDefinition[];
  readonly notice: string | null;
  readonly legacyUnreadable: boolean;
  /** Muda quando o editor precisa remontar sem trocar de processo (rascunho substituído por uma versão). */
  readonly generation: number;
  readonly guardRef: RefObject<EditorGuard | null>;
  /** Há uma troca esperando a confirmação, porque o rascunho aberto tem alteração não salva. */
  readonly confirmingSwitch: boolean;
  readonly showNotice: (message: string) => void;
  readonly dismissNotice: () => void;
  readonly remount: () => void;
  /** Catálogo mais recente da tela, inclusive o que ela mudou e ainda não renderizou. */
  readonly current: () => ProcessCatalog;
  readonly openProcess: (definitionId: string) => void;
  /** Roda `run` agora ou, com alteração não salva no editor, depois da confirmação. */
  readonly requestGuarded: (run: () => void) => void;
  readonly requestOpen: (definitionId: string) => void;
  readonly saveAndSwitch: () => Promise<void>;
  readonly switchWithoutSaving: () => void;
  readonly cancelSwitch: () => void;
  /** Recarrega o catálogo e reabre o editor com o que está gravado, descartando o que a tela tinha e não gravou. */
  readonly reloadFromServer: () => Promise<void>;
  /** No conflito, grava a versão desta tela por cima da que foi gravada em outro lugar. */
  readonly keepMine: () => Promise<void>;
}

function readCatalog(catalog: ProcessCatalog): CatalogChanged {
  return { ok: true, catalog };
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Estado da página de processos: o catálogo, a primeira carga, o processo aberto (pelo endereço, pelo último aberto
 * nesta aba ou pelo primeiro) e a confirmação das trocas quando o rascunho aberto tem alteração não salva.
 */
export function useProcessWorkspace(
  params: UseProcessWorkspaceParams,
): ProcessWorkspace {
  const { catalogStore, legacyStore, activeStore, sample, remote } = params;
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [legacyUnreadable, setLegacyUnreadable] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const guardRef = useRef<EditorGuard>(null);

  const { access, reloadFromServer, keepMine } = useWorkspaceCatalog({
    catalogStore,
    remote,
    ready,
    activeId,
    guardRef,
    onOpen: setActiveId,
    onRemount: () => setGeneration((value) => value + 1),
    showNotice: setNotice,
  });
  const { catalog, loaded, update } = access;

  const openFirst = useEffectEvent(() => {
    // NOTE: a carga confere o catálogo dentro da mudança; repetida (StrictMode, outra aba), não duplica nada. Com a
    // API não há carga: o exemplo vem dos dados do servidor.
    const seeded = remote
      ? { catalog: update(readCatalog).catalog, legacyUnreadable: false }
      : update((stored) =>
          seedCatalog({
            catalog: stored,
            legacyDraft: legacyStore.load(),
            sample,
            at: nowIso(),
          }),
        );
    const address = resolveAddressRequest({
      catalog: seeded.catalog,
      requestedId: readRequestedProcess(),
      place: storagePlace(remote),
    });
    const opened = openDefinition({
      live: liveDefinitions(seeded.catalog),
      candidates: [address.definitionId, activeStore.load()],
    });
    setActiveId(opened?.id ?? null);
    setNotice(address.notice ?? null);
    if (seeded.legacyUnreadable) {
      setLegacyUnreadable(true);
    }
    setReady(true);
  });

  useEffect(() => {
    if (loaded && !ready) {
      openFirst();
    }
  }, [loaded, ready]);

  useEffect(() => {
    if (activeId === null) {
      return;
    }
    activeStore.save(activeId);
    writeProcessAddress(activeId);
  }, [activeId, activeStore]);

  const openProcess = useCallback((definitionId: string) => {
    setActiveId(definitionId);
    setNotice(null);
  }, []);

  const current = useCallback(() => update(readCatalog).catalog, [update]);

  const requestGuarded = useCallback((run: () => void) => {
    if (guardRef.current?.hasChanges) {
      setPending({ run });
      return;
    }
    run();
  }, []);

  function requestOpen(definitionId: string) {
    if (definitionId === activeId) {
      return;
    }
    requestGuarded(() => openProcess(definitionId));
  }

  async function saveAndSwitch() {
    const saved = (await guardRef.current?.save()) ?? true;
    setPending(null);
    if (saved) {
      pending?.run();
    }
  }

  function switchWithoutSaving() {
    setPending(null);
    pending?.run();
  }

  const active =
    activeId === null
      ? undefined
      : findDefinition({ catalog, definitionId: activeId });
  const live = liveDefinitions(catalog);
  return {
    access,
    ready,
    active,
    live,
    archived: catalog.definitions.filter((definition) => definition.archived),
    notice,
    legacyUnreadable,
    generation,
    guardRef,
    // NOTE: no conflito a confirmação sai da frente, para a escolha do conflito ficar ao alcance; o "salvar e trocar"
    // que estava esperando a gravação termina depois da escolha.
    confirmingSwitch: pending !== null && access.conflict === null,
    showNotice: setNotice,
    dismissNotice: () => setNotice(null),
    remount: () => setGeneration((value) => value + 1),
    current,
    openProcess,
    requestGuarded,
    requestOpen,
    saveAndSwitch,
    switchWithoutSaving,
    cancelSwitch: () => setPending(null),
    reloadFromServer,
    keepMine,
  };
}

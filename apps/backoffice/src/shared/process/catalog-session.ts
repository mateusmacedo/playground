import {
  type CatalogResult,
  EMPTY_CATALOG,
  type ProcessCatalog,
} from './catalog';
import type {
  CatalogChange,
  CatalogSession,
  CatalogSessionParams,
  CatalogSnapshot,
  CommitOutcome,
} from './catalog-session-contract';
import type { CatalogFailed, CatalogSaveResult } from './catalog-store';

const INITIAL: CatalogSnapshot = {
  catalog: EMPTY_CATALOG,
  loaded: false,
  loading: false,
  loadFailure: null,
  storageFailed: false,
  conflict: null,
};

const SNAPSHOT_KEYS = Object.keys(
  INITIAL,
) as readonly (keyof CatalogSnapshot)[];

const NOT_LOADED: CatalogFailed = {
  ok: false,
  failure: {
    kind: 'unavailable',
    message: 'O catálogo de processos ainda não foi lido.',
  },
};

interface PersistParams {
  readonly catalog: ProcessCatalog;
  /** Grava por cima do que outro lugar gravou. */
  readonly overwrite: boolean;
}

interface ReadParams {
  /** Releitura automática: não mostra carregamento nem falha, e desiste se a tela mudar enquanto lê. */
  readonly silent: boolean;
}

type Choice = (kept: boolean) => void;

export function createCatalogSession(
  params: CatalogSessionParams,
): CatalogSession {
  const { store, holdRefresh, onRefreshed } = params;
  const listeners = new Set<() => void>();
  let snapshot = INITIAL;
  /** Catálogo mais recente desta tela, base da próxima mudança; `null` até a primeira leitura. */
  let latest: ProcessCatalog | null = null;
  /** Mudanças pedidas antes da primeira leitura, refeitas sobre o catálogo lido. */
  let early: CatalogChange<CatalogResult>[] = [];
  /** Conta as mudanças desta tela, para saber se houve outra enquanto uma leitura ou gravação estava a caminho. */
  let changes = 0;
  /** A tela tem mudança que o armazenamento não confirmou. */
  let ahead = false;
  let reading: Promise<ProcessCatalog | null> | null = null;
  let writing = 0;
  /** Mudanças que esperam a escolha do conflito. */
  let waiting: Choice[] = [];

  function publish(patch: Partial<CatalogSnapshot>): void {
    const next: CatalogSnapshot = { ...snapshot, ...patch };
    if (SNAPSHOT_KEYS.every((key) => next[key] === snapshot[key])) {
      // WHY: quem ouve renderiza a tela de novo a cada aviso; sem mudança, não há o que avisar.
      return;
    }
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function adopt(catalog: ProcessCatalog): void {
    latest = catalog;
    publish({ catalog });
  }

  function settleWaiting(kept: boolean): void {
    const choices = waiting;
    waiting = [];
    for (const choose of choices) {
      choose(kept);
    }
  }

  async function persist(args: PersistParams): Promise<CatalogSaveResult> {
    writing += 1;
    const result = args.overwrite
      ? await store.overwrite(args.catalog)
      : await store.save(args.catalog);
    writing -= 1;
    return result;
  }

  /** Registra o resultado de uma gravação; as respostas chegam na ordem dos pedidos, então a última é a que vale. */
  function noteSaved(result: CatalogSaveResult): void {
    if (result.ok) {
      ahead = false;
      publish({ storageFailed: false, conflict: null });
      settleWaiting(true);
      return;
    }
    ahead = true;
    if (result.failure.kind === 'conflict') {
      // NOTE: o que ficou sem gravar passa a esperar a escolha do conflito, que é o aviso que vale.
      publish({ conflict: result.failure, storageFailed: false });
      return;
    }
    publish({ storageFailed: true });
  }

  /** Grava o catálogo da tela, e de novo enquanto ela mudar durante a gravação. */
  async function flush(overwrite: boolean): Promise<CatalogSaveResult> {
    if (latest === null) {
      return NOT_LOADED;
    }
    let seen = changes;
    let result = await persist({ catalog: latest, overwrite });
    while (result.ok && seen !== changes) {
      seen = changes;
      result = await persist({ catalog: latest, overwrite });
    }
    return result;
  }

  function replayEarly(base: ProcessCatalog): ProcessCatalog {
    let catalog = base;
    for (const change of early) {
      const result = change(catalog);
      if (result.ok) {
        catalog = result.catalog;
      }
    }
    early = [];
    return catalog;
  }

  async function read(args: ReadParams): Promise<ProcessCatalog | null> {
    const { silent } = args;
    const before = latest;
    const seen = changes;
    if (!silent) {
      publish({ loading: true, loadFailure: null });
    }
    const result = await store.load();
    if (!result.ok) {
      if (!silent) {
        publish({ loading: false, loadFailure: result.failure });
      }
      return null;
    }
    if (silent && seen !== changes) {
      // WHY: a tela mudou enquanto a releitura automática estava a caminho; adotar o que foi lido apagaria a mudança.
      return null;
    }
    const stored = result.catalog ?? EMPTY_CATALOG;
    const catalog = replayEarly(stored);
    ahead = false;
    latest = catalog;
    publish({
      catalog,
      loaded: true,
      loading: false,
      loadFailure: null,
      storageFailed: false,
      conflict: null,
    });
    settleWaiting(false);
    if (catalog !== stored) {
      noteSaved(await flush(false));
    }
    if (silent && before !== null) {
      onRefreshed?.({ before, after: catalog });
    }
    return catalog;
  }

  function startReading(args: ReadParams): Promise<ProcessCatalog | null> {
    // NOTE: uma leitura por vez; quem pede outra enquanto isso recebe a que já está a caminho.
    if (reading === null) {
      const current = read(args).finally(() => {
        reading = null;
      });
      reading = current;
    }
    return reading;
  }

  function refresh(): Promise<ProcessCatalog | null> {
    const busy = reading !== null || writing > 0 || waiting.length > 0;
    // NOTE: depois de uma gravação que não foi feita, a tela está à frente do que ficou gravado; reler traria o
    // antigo.
    const dirty = ahead || snapshot.conflict !== null;
    if (latest === null || busy || dirty || holdRefresh?.()) {
      return Promise.resolve(null);
    }
    return startReading({ silent: true });
  }

  function update<R extends CatalogResult>(change: CatalogChange<R>): R {
    const current = latest ?? snapshot.catalog;
    const result = change(current);
    if (!result.ok || result.catalog === current) {
      return result;
    }
    changes += 1;
    if (latest === null) {
      // NOTE: mudança pedida antes da primeira leitura fica na tela e é refeita sobre o catálogo lido, para não gravar
      // por cima dele.
      early.push(change);
      publish({ catalog: result.catalog });
      return result;
    }
    adopt(result.catalog);
    if (snapshot.conflict !== null) {
      // NOTE: em conflito nada é enviado; a mudança fica na tela e vai junto na escolha de manter a versão dela.
      return result;
    }
    void persist({ catalog: result.catalog, overwrite: false }).then(noteSaved);
    return result;
  }

  function awaitChoice<R extends CatalogResult>(
    saved: CommitOutcome<R>,
  ): Promise<CommitOutcome<R>> {
    return new Promise((resolve) => {
      waiting.push((kept) => resolve(kept ? saved : { kind: 'discarded' }));
    });
  }

  async function commit<R extends CatalogResult>(
    change: CatalogChange<R>,
  ): Promise<CommitOutcome<R>> {
    const before = latest;
    if (before === null) {
      return { kind: 'failed', failure: NOT_LOADED.failure };
    }
    const result = change(before);
    if (!result.ok) {
      return { kind: 'refused', refusal: result.refusal };
    }
    const saved: CommitOutcome<R> = {
      kind: 'saved',
      // NOTE: `ok` já foi conferido; o TypeScript não estreita o tipo genérico sozinho.
      result: result as Extract<R, { readonly ok: true }>,
    };
    const changed = result.catalog !== before;
    if (!changed && !ahead) {
      return saved;
    }
    const wasAhead = ahead;
    if (changed) {
      changes += 1;
      adopt(result.catalog);
    }
    if (snapshot.conflict !== null) {
      return awaitChoice(saved);
    }
    const written = await persist({
      catalog: result.catalog,
      overwrite: false,
    });
    if (written.ok) {
      noteSaved(written);
      return saved;
    }
    if (written.failure.kind === 'conflict') {
      noteSaved(written);
      return awaitChoice(saved);
    }
    if (changed && latest === result.catalog) {
      // WHY: a gravação falhou e nada mais mudou: a mudança sai da tela, que volta a mostrar só o que está gravado, e
      // quem pediu pode tentar de novo.
      adopt(before);
      ahead = wasAhead;
    } else {
      noteSaved(written);
    }
    return { kind: 'failed', failure: written.failure };
  }

  async function retrySave(): Promise<boolean> {
    const result = await flush(false);
    noteSaved(result);
    return result.ok;
  }

  async function keepMine(): Promise<boolean> {
    const result = await flush(true);
    // NOTE: a falha que não é outro conflito deixa a escolha como estava, para a pessoa tentar de novo.
    if (result.ok || result.failure.kind === 'conflict') {
      noteSaved(result);
    }
    return result.ok;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      void (snapshot.loaded ? refresh() : startReading({ silent: false }));
    },
    adopt,
    reload: () => startReading({ silent: false }),
    refresh,
    update,
    commit,
    retrySave,
    keepMine,
  };
}

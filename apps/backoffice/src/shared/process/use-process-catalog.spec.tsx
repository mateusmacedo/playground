import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { Activity, useEffect } from 'react';

import { PanelApiProvider } from '@/shared/api/panel-api-context';

import { EMPTY_CATALOG, type ProcessCatalog } from './catalog';
import { createDefinition, renameDefinition } from './catalog-changes';
import { parseCatalog, serializeCatalog } from './catalog-format';
import {
  scriptedCatalogStore,
  storeFailure,
} from './catalog-session-test-store';
import {
  CATALOG_STORAGE_KEY,
  type CatalogListener,
  type CatalogSaveResult,
  type CatalogStore,
} from './catalog-store';
import { testDefinition } from './catalog-test-data';
import { fakeDefinitionsApi } from './definitions-api-fake';
import {
  type ProcessCatalogAccess,
  useProcessCatalog,
} from './use-process-catalog';

const AT = '2026-11-26T15:00:00.000Z';

const stored: ProcessCatalog = { definitions: [testDefinition()] };

const fromOtherTab: ProcessCatalog = {
  definitions: [testDefinition({ id: 'process-2', name: 'Cobrança' })],
};

function storeCatalog(catalog: ProcessCatalog): void {
  localStorage.setItem(CATALOG_STORAGE_KEY, serializeCatalog(catalog));
}

function storedNames(): string[] {
  const catalog = parseCatalog(localStorage.getItem(CATALOG_STORAGE_KEY));
  return catalog?.definitions.map((definition) => definition.name) ?? [];
}

function names(access: ProcessCatalogAccess): string[] {
  return access.catalog.definitions.map((definition) => definition.name);
}

/** Mudança que cria o processo de nome `name`. */
function creating(name: string) {
  return (catalog: ProcessCatalog) =>
    createDefinition({ catalog, name, at: AT });
}

function refuseWrites() {
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('cheio', 'QuotaExceededError');
  });
}

/** Tela que lista os processos do catálogo e cria mais um. */
function Screen() {
  const { catalog, update } = useProcessCatalog();
  return (
    <>
      <button type="button" onClick={() => update(creating('Cobrança'))}>
        Criar processo
      </button>
      <ul aria-label="Processos">
        {catalog.definitions.map((definition) => (
          <li key={definition.id}>{definition.name}</li>
        ))}
      </ul>
    </>
  );
}

interface RouteProps {
  readonly visible: boolean;
}

/** Rota que o Next esconde ao navegar para outra, sem desmontar. */
function Route({ visible }: RouteProps) {
  return (
    <Activity mode={visible ? 'visible' : 'hidden'}>
      <Screen />
    </Activity>
  );
}

function listedNames(): (string | null)[] {
  return screen.getAllByRole('listitem').map((item) => item.textContent);
}

interface EarlyChangeProps {
  readonly update: ProcessCatalogAccess['update'];
}

/** Filho que muda o catálogo no próprio efeito, antes de o efeito de leitura da tela rodar. */
function EarlyChange({ update }: EarlyChangeProps) {
  useEffect(() => {
    update(creating('Cobrança'));
  }, [update]);
  return null;
}

function EagerScreen() {
  const { update } = useProcessCatalog();
  return <EarlyChange update={update} />;
}

/** Armazenamento em memória, com a lista de quem está ouvindo. */
function fakeStore(initial: ProcessCatalog | null) {
  const listeners = new Set<CatalogListener>();
  const save = vi.fn(
    async (_catalog: ProcessCatalog): Promise<CatalogSaveResult> => ({
      ok: true,
    }),
  );
  const store: CatalogStore = {
    load: async () => ({ ok: true, catalog: initial }),
    save,
    overwrite: save,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { store, save, listeners };
}

/** O hook com a primeira leitura do catálogo já feita. */
async function renderLoaded(store?: CatalogStore) {
  const view = renderHook(() => useProcessCatalog(store));
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  return view;
}

describe('useProcessCatalog', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('leitura', () => {
    it('começa vazio e sem leitura, como na renderização do servidor', async () => {
      storeCatalog(stored);
      const renders: ProcessCatalogAccess[] = [];

      renderHook(() => {
        const access = useProcessCatalog();
        renders.push(access);
        return access;
      });

      expect(renders[0]).toMatchObject({
        catalog: EMPTY_CATALOG,
        loaded: false,
        storageFailed: false,
      });
      await waitFor(() => expect(renders.at(-1)?.loaded).toBe(true));
    });

    it('lê o catálogo gravado depois de montar', async () => {
      storeCatalog(stored);

      const { result } = await renderLoaded();

      expect(result.current.catalog).toEqual(stored);
    });

    it('sem catálogo gravado, termina a leitura com o catálogo vazio', async () => {
      const { result } = await renderLoaded();

      expect(result.current.catalog).toBe(EMPTY_CATALOG);
    });

    it('com o armazenamento bloqueado, termina a leitura com o catálogo vazio', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('bloqueado', 'SecurityError');
      });

      const { result } = await renderLoaded();

      expect(result.current.catalog).toBe(EMPTY_CATALOG);
    });
  });

  describe('mudança', () => {
    it('aplica a mudança, devolve o resultado dela e grava', async () => {
      storeCatalog(stored);
      const { result } = await renderLoaded();

      const created = await act(async () =>
        result.current.update(creating('Cobrança')),
      );

      expect(created).toMatchObject({ ok: true, definitionId: 'process-2' });
      expect(names(result.current)).toEqual(['Atendimento', 'Cobrança']);
      expect(storedNames()).toEqual(['Atendimento', 'Cobrança']);
      expect(result.current.storageFailed).toBe(false);
    });

    it('cria o primeiro processo quando não há catálogo gravado', async () => {
      const { result } = await renderLoaded();

      await act(async () => result.current.update(creating('Cobrança')));

      expect(storedNames()).toEqual(['Cobrança']);
    });

    it('devolve a recusa sem mudar nem gravar', async () => {
      storeCatalog(stored);
      const { result } = await renderLoaded();
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      const refused = await act(async () =>
        result.current.update(creating('atendimento')),
      );

      expect(refused).toMatchObject({
        ok: false,
        refusal: { code: 'name-taken' },
      });
      expect(names(result.current)).toEqual(['Atendimento']);
      expect(setItem).not.toHaveBeenCalled();
    });

    it('não grava a mudança que deixa o catálogo como estava', async () => {
      storeCatalog(stored);
      const { result } = await renderLoaded();
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      await act(async () =>
        result.current.update((catalog) =>
          renameDefinition({
            catalog,
            definitionId: 'process-1',
            name: 'Atendimento',
            at: AT,
          }),
        ),
      );

      expect(setItem).not.toHaveBeenCalled();
    });

    it('aplica a segunda mudança sobre o resultado da primeira', async () => {
      storeCatalog(stored);
      const { result } = await renderLoaded();

      await act(async () => {
        result.current.update(creating('Cobrança'));
        result.current.update(creating('Compras'));
      });

      expect(storedNames()).toEqual(['Atendimento', 'Cobrança', 'Compras']);
    });

    it('parte do catálogo gravado quando a mudança vem antes da primeira leitura', async () => {
      storeCatalog(stored);

      render(<EagerScreen />);

      await waitFor(() =>
        expect(storedNames()).toEqual(['Atendimento', 'Cobrança']),
      );
    });
  });

  describe('falha de gravação', () => {
    it('vira estado e mantém a mudança na memória', async () => {
      storeCatalog(stored);
      const { result } = await renderLoaded();
      refuseWrites();

      await act(async () => result.current.update(creating('Cobrança')));

      expect(result.current.storageFailed).toBe(true);
      expect(names(result.current)).toEqual(['Atendimento', 'Cobrança']);
      expect(storedNames()).toEqual(['Atendimento']);
    });

    it('some quando a gravação seguinte dá certo', async () => {
      storeCatalog(stored);
      const { result } = await renderLoaded();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('cheio', 'QuotaExceededError');
      });
      await act(async () => result.current.update(creating('Cobrança')));

      await act(async () => result.current.update(creating('Compras')));

      expect(result.current.storageFailed).toBe(false);
      expect(storedNames()).toEqual(['Atendimento', 'Cobrança', 'Compras']);
    });
  });

  describe('outras abas e outras telas', () => {
    it('acompanha o que outra aba grava, sem gravar de volta', async () => {
      storeCatalog(stored);
      const { result } = await renderLoaded();
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: CATALOG_STORAGE_KEY,
            newValue: serializeCatalog(fromOtherTab),
          }),
        );
      });

      expect(names(result.current)).toEqual(['Cobrança']);
      expect(setItem).not.toHaveBeenCalled();
    });

    it('faz a mudança seguinte sobre o que a outra aba gravou', async () => {
      storeCatalog(stored);
      const { result } = await renderLoaded();
      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: CATALOG_STORAGE_KEY,
            newValue: serializeCatalog(fromOtherTab),
          }),
        );
      });

      await act(async () => result.current.update(creating('Compras')));

      expect(storedNames()).toEqual(['Cobrança', 'Compras']);
    });

    it('mostra numa tela o que outra tela da mesma aba grava', async () => {
      storeCatalog(stored);
      const editor = await renderLoaded();
      const board = await renderLoaded();

      await act(async () => editor.result.current.update(creating('Cobrança')));

      expect(names(board.result.current)).toEqual(['Atendimento', 'Cobrança']);
    });

    it('relê o catálogo quando a rota escondida volta a aparecer', async () => {
      storeCatalog(stored);
      const { rerender } = render(<Route visible />);
      await screen.findByText('Atendimento');
      rerender(<Route visible={false} />);
      storeCatalog(fromOtherTab);

      rerender(<Route visible />);

      await waitFor(() => expect(listedNames()).toEqual(['Cobrança']));
    });

    it('ao voltar a aparecer depois de uma gravação recusada, mantém o que está na memória', async () => {
      storeCatalog(stored);
      const { rerender } = render(<Route visible />);
      await screen.findByText('Atendimento');
      refuseWrites();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Criar processo' }));
      });
      rerender(<Route visible={false} />);

      await act(async () => {
        rerender(<Route visible />);
      });

      expect(listedNames()).toEqual(['Atendimento', 'Cobrança']);
    });
  });

  describe('armazenamento informado', () => {
    it('lê e grava no armazenamento informado, não no do navegador', async () => {
      const { store, save } = fakeStore(stored);
      const { result } = await renderLoaded(store);

      const created = await act(async () =>
        result.current.update(creating('Cobrança')),
      );

      expect(result.current.loaded).toBe(true);
      expect(save).toHaveBeenCalledExactlyOnceWith(
        created.ok ? created.catalog : null,
      );
      expect(storedNames()).toEqual([]);
    });

    it('passa a mostrar o catálogo que o armazenamento avisa', async () => {
      const { store, listeners } = fakeStore(stored);
      const { result } = await renderLoaded(store);

      act(() => {
        for (const listener of listeners) {
          listener(fromOtherTab);
        }
      });

      expect(result.current.catalog).toBe(fromOtherTab);
    });

    it('para de ouvir o armazenamento ao desmontar', () => {
      const { store, listeners } = fakeStore(stored);
      const { unmount } = renderHook(() => useProcessCatalog(store));

      unmount();

      expect(listeners.size).toBe(0);
    });

    it('espera a gravação da mudança quando a tela pede', async () => {
      const { store, save } = fakeStore(stored);
      const { result } = await renderLoaded(store);

      const outcome = await act(async () =>
        result.current.commit(creating('Cobrança')),
      );

      expect(outcome).toMatchObject({ kind: 'saved' });
      expect(save).toHaveBeenCalledOnce();
      expect(names(result.current)).toEqual(['Atendimento', 'Cobrança']);
    });

    it('mostra o conflito e o encerra quando a tela escolhe manter a versão dela', async () => {
      const store = scriptedCatalogStore(stored);
      const { result, unmount } = await renderLoaded(store);
      store.nextSaves.push(
        storeFailure({ kind: 'conflict', message: 'alterado em outro lugar' }),
      );
      act(() => {
        result.current.update(creating('Cobrança'));
      });
      await waitFor(() => expect(result.current.conflict).not.toBeNull());

      await act(async () => {
        await result.current.keepMine();
      });
      unmount();

      expect(result.current.conflict).toBeNull();
      expect(store.overwrites).toHaveLength(1);
    });

    it('grava de novo quando a tela pede, depois de uma gravação que falhou', async () => {
      const store = scriptedCatalogStore(stored);
      const { result } = await renderLoaded(store);
      store.nextSaves.push(
        storeFailure({ kind: 'unavailable', message: 'sem rede' }),
      );
      act(() => {
        result.current.update(creating('Cobrança'));
      });
      await waitFor(() => expect(result.current.storageFailed).toBe(true));

      await act(async () => {
        await result.current.retrySave();
      });

      expect(result.current.storageFailed).toBe(false);
    });

    it('usa as opções da renderização mais recente na releitura automática', async () => {
      const { store } = fakeStore(stored);
      const first = vi.fn();
      const latest = vi.fn();
      const { result, rerender } = renderHook(
        (onRefreshed: () => void) =>
          useProcessCatalog(store, { onRefreshed, holdRefresh: () => false }),
        { initialProps: first },
      );
      await waitFor(() => expect(result.current.loaded).toBe(true));
      rerender(latest);

      await act(async () => {
        await result.current.refresh();
      });

      expect(first).not.toHaveBeenCalled();
      expect(latest).toHaveBeenCalledOnce();
    });
  });

  describe('com a API do painel', () => {
    function withApi(api: ReturnType<typeof fakeDefinitionsApi>) {
      return renderHook(() => useProcessCatalog(), {
        wrapper: ({ children }) => (
          <PanelApiProvider
            value={{ boards: {} as never, processDefinitions: api }}
          >
            {children}
          </PanelApiProvider>
        ),
      });
    }

    it('lê o catálogo do servidor, e não o do navegador', async () => {
      storeCatalog(fromOtherTab);
      const { result } = withApi(fakeDefinitionsApi(stored.definitions));

      await waitFor(() => expect(result.current.loaded).toBe(true));

      expect(names(result.current)).toEqual(['Atendimento']);
    });

    it('grava a mudança no servidor', async () => {
      const api = fakeDefinitionsApi(stored.definitions);
      const { result } = withApi(api);
      await waitFor(() => expect(result.current.loaded).toBe(true));

      await act(async () => result.current.update(creating('Cobrança')));

      await waitFor(() => expect(api.stored('process-2')).toBeDefined());
      expect(storedNames()).toEqual([]);
    });

    it('mostra o motivo quando o servidor não responde e lê na nova tentativa', async () => {
      const api = fakeDefinitionsApi(stored.definitions);
      api.failNext({ operation: 'list', kind: 'network' });
      const { result } = withApi(api);
      await waitFor(() => expect(result.current.loadFailure).not.toBeNull());

      await act(async () => {
        await result.current.reload();
      });

      expect(result.current).toMatchObject({ loaded: true, loadFailure: null });
      expect(names(result.current)).toEqual(['Atendimento']);
    });
  });
});

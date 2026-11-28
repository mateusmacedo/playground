import { act, renderHook } from '@testing-library/react';

import { API_ERROR_MESSAGES } from '@/shared/api/api-result';

import type { Board } from './model/board';
import { createBoard } from './model/board-state';
import {
  ACTIVE_BOARD_STORAGE_KEY,
  boardStorageKey,
  type WorkspaceBoard,
} from './model/workspace';
import {
  createFakeBoardsApi,
  type FakeBoardsApi,
  storedDocument,
} from './store/boards-api-test-kit';
import { createBrowserWorkspaceStore } from './store/browser-workspace-store';
import { createHttpWorkspaceStore } from './store/http-workspace-store';
import type { WorkspaceStore } from './store/workspace-store';
import { boardViewKey } from './use-board-view';
import { collapsedLanesKey } from './use-collapsed-lanes';
import { useWorkspace } from './use-workspace';

const WRITE_DELAY = 200;

function titled(title: string): Board {
  return createBoard({ lanes: [{ id: 'lane-1', title, cards: [] }] });
}

function putOnServer(api: FakeBoardsApi, id: string, name: string): void {
  api.documents.set(
    id,
    storedDocument({ id, name, revision: 1, board: titled(name) }),
  );
}

interface SetupParams {
  readonly requestedId?: string;
}

/** Servidor simulado com os quadros "Principal" e "Vendas", e a lista de quadros lendo dele. */
function setup(params: SetupParams = {}) {
  const api = createFakeBoardsApi();
  putOnServer(api, 'board-1', 'Principal');
  putOnServer(api, 'board-2', 'Vendas');
  const store = createHttpWorkspaceStore({
    api,
    defaultContent: () => titled('Do exemplo'),
    writeDelayMs: WRITE_DELAY,
  });
  const hook = renderHook(() =>
    useWorkspace({
      store,
      readRequestedId: () => params.requestedId ?? null,
    }),
  );
  return { api, store, ...hook };
}

/** Avança o relógio simulado e deixa o React aplicar o que as chamadas à API mudaram. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function opened(params: SetupParams = {}) {
  const context = setup(params);
  await advance(0);
  context.api.calls.length = 0;
  return context;
}

describe('useWorkspace com os quadros na API', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('espera a lista do servidor e abre o primeiro quadro', async () => {
    const { result } = setup();
    expect(result.current).toMatchObject({
      loaded: false,
      phase: { kind: 'loading' },
    });

    await advance(0);

    expect(result.current).toMatchObject({
      boards: [
        { id: 'board-1', name: 'Principal' },
        { id: 'board-2', name: 'Vendas' },
      ],
      activeId: 'board-1',
      loaded: true,
      phase: { kind: 'ready' },
      failure: null,
    });
  });

  it('abre o quadro do endereço e, sem ele, o aberto por último', async () => {
    localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, 'board-2');

    const lastOpen = await opened({ requestedId: 'board-9' });
    const fromAddress = await opened({ requestedId: 'board-1' });

    expect(fromAddress.result.current.activeId).toBe('board-1');
    expect(lastOpen.result.current.activeId).toBe('board-2');
  });

  it('mostra a falha da leitura e lê de novo quando pedem', async () => {
    const { api, result } = setup();
    api.failNext('network');
    await advance(0);
    expect(result.current.phase).toEqual({
      kind: 'failed',
      message: API_ERROR_MESSAGES.network,
    });

    act(() => result.current.retryLoad());
    expect(result.current.phase).toEqual({ kind: 'loading' });
    await advance(0);

    expect(result.current.loaded).toBe(true);
  });

  it('cria o quadro com o prefixo escolhido, abre e grava no servidor', async () => {
    const { api, result } = await opened();
    let id: string | undefined;

    act(() => {
      id = result.current.commands.create({
        name: ' Compras ',
        keyPrefix: 'CP',
      });
    });
    await advance(WRITE_DELAY);

    expect(id).toBe('board-3');
    expect(result.current.activeId).toBe('board-3');
    expect(result.current.boards.at(-1)).toEqual({
      id: 'board-3',
      name: 'Compras',
    });
    expect(api.documents.get('board-3')).toMatchObject({
      name: 'Compras',
      revision: 1,
      board: { config: { keyPrefix: 'CP' } },
    });
  });

  it('não cria quadro com nome vazio ou repetido', async () => {
    const { api, result } = await opened();
    let ids: (string | undefined)[] = [];

    act(() => {
      ids = [
        result.current.commands.create({ name: '  ', keyPrefix: 'QD' }),
        result.current.commands.create({ name: 'vendas', keyPrefix: 'QD' }),
      ];
    });
    await advance(WRITE_DELAY);

    expect(ids).toEqual([undefined, undefined]);
    expect(api.calls).toEqual([]);
  });

  it('renomeia o quadro regravando o documento dele', async () => {
    const { api, store, result } = await opened();
    await store.board('board-1').load();

    act(() =>
      result.current.commands.rename({ boardId: 'board-1', name: 'Operação' }),
    );
    await advance(WRITE_DELAY);

    expect(result.current.boards[0]).toEqual({
      id: 'board-1',
      name: 'Operação',
    });
    expect(api.documents.get('board-1')).toMatchObject({
      name: 'Operação',
      revision: 2,
    });
  });

  it('não renomeia para um nome repetido, nem quadro que não existe', async () => {
    const { api, result } = await opened();

    act(() => {
      result.current.commands.rename({ boardId: 'board-1', name: 'Vendas' });
      result.current.commands.rename({ boardId: 'board-9', name: 'Outro' });
    });
    await advance(WRITE_DELAY);

    expect(api.calls).toEqual([]);
    expect(result.current.boards[0]?.name).toBe('Principal');
  });

  it('exclui o quadro aberto, passa para o vizinho e apaga as preferências de tela dele', async () => {
    const { api, result } = await opened({ requestedId: 'board-2' });
    const key = boardStorageKey('board-2');
    localStorage.setItem(collapsedLanesKey(key), '[]');
    localStorage.setItem(boardViewKey(key), '{}');

    act(() => result.current.commands.remove('board-2'));
    await advance(0);

    expect(result.current.boards).toEqual([
      { id: 'board-1', name: 'Principal' },
    ]);
    expect(result.current.activeId).toBe('board-1');
    expect(api.documents.has('board-2')).toBe(false);
    expect(localStorage.getItem(collapsedLanesKey(key))).toBeNull();
    expect(localStorage.getItem(boardViewKey(key))).toBeNull();
    expect(result.current.failure).toBeNull();
  });

  it('não exclui o último quadro nem o que não existe', async () => {
    const { api, result } = await opened();

    act(() => result.current.commands.remove('board-9'));
    act(() => result.current.commands.remove('board-2'));
    await advance(0);
    api.calls.length = 0;
    act(() => result.current.commands.remove('board-1'));
    await advance(0);

    expect(api.calls).toEqual([]);
    expect(result.current.boards).toHaveLength(1);
  });

  it('devolve o quadro ao lugar dele, com o aviso, quando o servidor não exclui', async () => {
    const { api, result } = await opened();
    api.failNext('server');

    act(() => result.current.commands.remove('board-1'));
    expect(result.current.boards).toEqual([{ id: 'board-2', name: 'Vendas' }]);
    await advance(0);

    expect(result.current.boards.map((board) => board.id)).toEqual([
      'board-1',
      'board-2',
    ]);
    expect(result.current.failure).toBe(
      `Não foi possível excluir o quadro Principal. ${API_ERROR_MESSAGES.server}`,
    );
    act(() => result.current.dismissFailure());
    expect(result.current.failure).toBeNull();
  });

  it('ignora a lista que chega depois de a tela sair', async () => {
    const { api, result, unmount } = setup();
    const before = result.current;

    unmount();
    await advance(0);

    expect(api.calls).toEqual(['GET /boards']);
    expect(result.current).toBe(before);
  });

  it('escolhe só quadro que está na lista', async () => {
    const { result } = await opened();

    act(() => result.current.commands.select('board-9'));
    expect(result.current.activeId).toBe('board-1');
    act(() => result.current.commands.select('board-2'));

    expect(result.current.activeId).toBe('board-2');
    expect(localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY)).toBe('board-2');
  });

  it('na volta para a aba, passa para o vizinho quando o quadro aberto saiu do servidor', async () => {
    const { api, result } = await opened({ requestedId: 'board-2' });
    api.documents.delete('board-2');

    act(() => {
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('focus'));
    });
    await advance(0);

    expect(result.current.boards).toEqual([
      { id: 'board-1', name: 'Principal' },
    ]);
    expect(result.current.activeId).toBe('board-1');
  });
});

describe('useWorkspace com um armazenamento que entrega lista vazia', () => {
  it('fica no quadro principal ao abrir e mantém o quadro aberto quando a lista some', async () => {
    let deliver: (boards: readonly WorkspaceBoard[]) => void = () => undefined;
    const browser = createBrowserWorkspaceStore();
    const store: WorkspaceStore = {
      ...browser,
      loadList: async () => ({ kind: 'found', boards: [] }),
      watchList: (onChange) => {
        deliver = onChange;
        return () => undefined;
      },
    };

    const { result } = renderHook(() =>
      useWorkspace({ store, readRequestedId: () => null }),
    );
    await act(async () => undefined);
    expect(result.current).toMatchObject({ boards: [], activeId: 'board-1' });

    act(() => deliver([{ id: 'board-4', name: 'Outro' }]));
    expect(result.current.activeId).toBe('board-4');
    act(() => deliver([]));

    expect(result.current).toMatchObject({ boards: [], activeId: 'board-4' });
  });
});

describe('useWorkspace com os quadros no navegador', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => localStorage.clear());

  it('mostra o quadro principal desde o começo, sem espera nem releitura na volta para a aba', async () => {
    const store = createBrowserWorkspaceStore();
    const { result } = renderHook(() =>
      useWorkspace({ store, readRequestedId: () => null }),
    );
    expect(result.current).toMatchObject({
      loaded: false,
      phase: { kind: 'ready' },
      activeId: 'board-1',
    });

    await act(async () => undefined);
    act(() => {
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current.loaded).toBe(true);
    expect(result.current.boards).toEqual([
      { id: 'board-1', name: 'Quadro principal' },
    ]);
  });
});

import { createBoard } from '../model/board-state';
import { serializeBoard } from '../model/storage';
import {
  BOARDS_STORAGE_KEY,
  boardStorageKey,
  DEFAULT_BOARDS,
  serializeBoards,
  type WorkspaceBoard,
} from '../model/workspace';
import { createBrowserWorkspaceStore } from './browser-workspace-store';

const boards: readonly WorkspaceBoard[] = [
  { id: 'board-1', name: 'Principal' },
  { id: 'board-2', name: 'Vendas' },
];

const content = createBoard({
  lanes: [{ id: 'lane-1', title: 'A fazer', cards: [] }],
  config: { keyPrefix: 'VD' },
});

function storageEvent(key: string, newValue: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}

describe('createBrowserWorkspaceStore', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => localStorage.clear());

  it('lê a lista gravada', async () => {
    localStorage.setItem(BOARDS_STORAGE_KEY, serializeBoards(boards));

    const result = await createBrowserWorkspaceStore().loadList();

    expect(result).toEqual({ kind: 'found', boards });
  });

  it('sem lista gravada, vale o quadro principal e a lista passa a existir', async () => {
    const result = await createBrowserWorkspaceStore().loadList();

    expect(result).toEqual({ kind: 'found', boards: DEFAULT_BOARDS });
    expect(localStorage.getItem(BOARDS_STORAGE_KEY)).toBe(
      serializeBoards(DEFAULT_BOARDS),
    );
  });

  it('entrega a lista que outra aba gravou e ignora a estragada', () => {
    const onChange = vi.fn();
    const stop = createBrowserWorkspaceStore().watchList?.(onChange);

    storageEvent(BOARDS_STORAGE_KEY, serializeBoards(boards));
    storageEvent(BOARDS_STORAGE_KEY, 'lixo');

    expect(onChange).toHaveBeenCalledExactlyOnceWith(boards);
    stop?.();
  });

  it('cria o quadro gravando o conteúdo e a lista', () => {
    const [, board] = boards;
    if (!board) {
      throw new Error('Sem o quadro de teste.');
    }

    createBrowserWorkspaceStore().create({ boards, board, content });

    expect(localStorage.getItem(boardStorageKey('board-2'))).toBe(
      serializeBoard(content),
    );
    expect(localStorage.getItem(BOARDS_STORAGE_KEY)).toBe(
      serializeBoards(boards),
    );
  });

  it('renomeia gravando a lista com o nome novo', () => {
    const renamed = [{ id: 'board-1', name: 'Operação' }];

    createBrowserWorkspaceStore().rename({
      boards: renamed,
      boardId: 'board-1',
      name: 'Operação',
    });

    expect(localStorage.getItem(BOARDS_STORAGE_KEY)).toBe(
      serializeBoards(renamed),
    );
  });

  it('exclui apagando o conteúdo do quadro e gravando a lista sem ele', async () => {
    localStorage.setItem(boardStorageKey('board-2'), serializeBoard(content));
    const store = createBrowserWorkspaceStore();
    const before = store.board('board-2');

    const reason = await store.remove({
      boards: DEFAULT_BOARDS,
      boardId: 'board-2',
    });

    expect(reason).toBeNull();
    expect(localStorage.getItem(boardStorageKey('board-2'))).toBeNull();
    expect(localStorage.getItem(BOARDS_STORAGE_KEY)).toBe(
      serializeBoards(DEFAULT_BOARDS),
    );
    expect(store.board('board-2')).not.toBe(before);
  });

  it('devolve sempre o mesmo armazenamento para o mesmo quadro, lendo a chave dele', async () => {
    localStorage.setItem(boardStorageKey('board-2'), serializeBoard(content));
    const store = createBrowserWorkspaceStore();

    const boardStore = store.board('board-2');
    const result = await boardStore.load();

    expect(store.board('board-2')).toBe(boardStore);
    expect(store.board('board-1')).not.toBe(boardStore);
    expect(result).toMatchObject({
      kind: 'found',
      board: { config: { keyPrefix: 'VD' } },
    });
  });

  it('não tem as saídas de quem lê de um servidor', () => {
    expect(createBrowserWorkspaceStore().remote).toBeUndefined();
  });
});

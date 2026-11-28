import type { Board } from '../model/board';
import { createBoard } from '../model/board-state';
import { parseStoredBoard, serializeBoard } from '../model/storage';
import { SAVED } from './board-store';
import { createBrowserBoardStore, STORAGE_FULL } from './browser-board-store';

const KEY = 'quadro:teste';

const stored: Board = createBoard({
  lanes: [{ id: 'lane-1', title: 'Gravada', cards: [] }],
});

const edited: Board = createBoard({
  lanes: [{ id: 'lane-1', title: 'Editada', cards: [] }],
});

function storageEvent(key: string, newValue: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}

describe('createBrowserBoardStore', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('lê o quadro gravado na chave', async () => {
    localStorage.setItem(KEY, serializeBoard(stored));

    const result = await createBrowserBoardStore(KEY).load();

    expect(result).toEqual({
      kind: 'found',
      board: parseStoredBoard(serializeBoard(stored)),
    });
  });

  it('diz que não há quadro quando a chave está vazia ou estragada', async () => {
    const store = createBrowserBoardStore(KEY);

    expect(await store.load()).toEqual({ kind: 'empty' });
    localStorage.setItem(KEY, '{quebrado');
    expect(await store.load()).toEqual({ kind: 'empty' });
  });

  it('grava cada mudança na hora', () => {
    const store = createBrowserBoardStore(KEY);

    store.save(edited);

    expect(localStorage.getItem(KEY)).toBe(serializeBoard(edited));
    expect(store.status()).toBe(SAVED);
  });

  it('não grava de volta o quadro que acabou de ler', async () => {
    localStorage.setItem(KEY, serializeBoard(stored));
    const store = createBrowserBoardStore(KEY);
    const result = await store.load();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    if (result.kind === 'found') {
      store.save(result.board);
    }

    expect(setItem).not.toHaveBeenCalled();
  });

  it('entrega o quadro que outra aba gravou e não o grava de volta', () => {
    const store = createBrowserBoardStore(KEY);
    const onChange = vi.fn<(board: Board) => void>();
    const stop = store.watch?.(onChange);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    storageEvent(KEY, serializeBoard(stored));
    storageEvent(KEY, '{quebrado');
    storageEvent('outra:chave', serializeBoard(edited));
    const [received] = onChange.mock.calls[0] ?? [];
    if (received) {
      store.save(received);
    }

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(received?.lanes[0]?.title).toBe('Gravada');
    expect(setItem).not.toHaveBeenCalled();
    stop?.();
    storageEvent(KEY, serializeBoard(edited));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('avisa quando o navegador não grava, e de novo quando volta a gravar', () => {
    const store = createBrowserBoardStore(KEY);
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('cheio', 'QuotaExceededError');
      });

    store.save(edited);
    expect(store.status()).toBe(STORAGE_FULL);
    expect(listener).toHaveBeenCalledTimes(1);

    setItem.mockRestore();
    store.save(stored);
    expect(store.status()).toBe(SAVED);
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    store.save(edited);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('não tem as saídas de quem grava num servidor', () => {
    expect(createBrowserBoardStore(KEY).remote).toBeUndefined();
  });
});

import { act, renderHook } from '@testing-library/react';

import type { Board } from './model/board';
import { createBoard } from './model/board-state';
import type { BoardLoad, BoardStore } from './store/board-store';
import { createStatusChannel } from './store/status-channel';
import { useBoardStorage } from './use-board-storage';

function titled(title: string): Board {
  return createBoard({ lanes: [{ id: 'lane-1', title, cards: [] }] });
}

const onScreen = titled('Na tela');
const stored = titled('Gravado');

/** Armazenamento simulado: a leitura fica em aberto até o teste a responder. */
function fakeStore(kind: 'browser' | 'remote') {
  const channel = createStatusChannel();
  const saved: Board[] = [];
  let answer: (result: BoardLoad) => void = () => undefined;
  const remote = {
    refresh: vi.fn(async (): Promise<Board | null> => null),
    retry: vi.fn(),
    keepMine: vi.fn(),
    takeTheirs: vi.fn(async (): Promise<Board | null> => null),
    flush: vi.fn(async (): Promise<void> => undefined),
  };
  const store: BoardStore = {
    load: vi.fn(
      () =>
        new Promise<BoardLoad>((resolve) => {
          answer = resolve;
        }),
    ),
    save: (board) => {
      saved.push(board);
    },
    status: channel.get,
    subscribe: channel.subscribe,
    remote: kind === 'remote' ? remote : undefined,
  };
  return {
    store,
    saved,
    remote,
    setStatus: channel.set,
    /** Responde a leitura em aberto e deixa o React aplicar o resultado. */
    answerLoad: async (result: BoardLoad) => {
      await act(async () => {
        answer(result);
      });
    },
  };
}

interface HookProps {
  readonly store: BoardStore | undefined;
  readonly board: Board;
}

function renderStorage(initial: HookProps) {
  const onStoredBoard = vi.fn<(board: Board) => void>();
  const hook = renderHook(
    (props: HookProps) => useBoardStorage({ ...props, onStoredBoard }),
    { initialProps: initial },
  );
  return { ...hook, onStoredBoard };
}

function comeBackToTab() {
  act(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
  });
}

describe('useBoardStorage', () => {
  it('sem armazenamento, o quadro já está pronto e nada é gravado', () => {
    const { result } = renderStorage({ store: undefined, board: onScreen });

    expect(result.current).toMatchObject({
      loaded: true,
      phase: { kind: 'ready' },
      save: { kind: 'saved' },
    });
    expect(result.current.saveActions).toBeUndefined();
  });

  it('espera o quadro do servidor, entrega o que chegou e só então grava as mudanças', async () => {
    const fake = fakeStore('remote');
    const { result, rerender, onStoredBoard } = renderStorage({
      store: fake.store,
      board: onScreen,
    });
    expect(result.current).toMatchObject({
      loaded: false,
      phase: { kind: 'loading' },
    });
    expect(fake.saved).toEqual([]);

    await fake.answerLoad({ kind: 'found', board: stored });
    expect(onStoredBoard).toHaveBeenCalledExactlyOnceWith(stored);
    expect(result.current).toMatchObject({
      loaded: true,
      phase: { kind: 'ready' },
    });

    const edited = titled('Editado');
    rerender({ store: fake.store, board: edited });
    expect(fake.saved.at(-1)).toBe(edited);
  });

  it('mostra a falha da leitura do servidor e lê de novo quando pedem', async () => {
    const fake = fakeStore('remote');
    const { result, onStoredBoard } = renderStorage({
      store: fake.store,
      board: onScreen,
    });

    await fake.answerLoad({ kind: 'failed', message: 'Sem rede.' });
    expect(result.current).toMatchObject({
      loaded: false,
      phase: { kind: 'failed', message: 'Sem rede.' },
    });
    expect(fake.saved).toEqual([]);

    act(() => result.current.retryLoad());
    expect(result.current.phase).toEqual({ kind: 'loading' });
    expect(fake.store.load).toHaveBeenCalledTimes(2);
    await fake.answerLoad({ kind: 'found', board: stored });
    expect(onStoredBoard).toHaveBeenCalledExactlyOnceWith(stored);
    expect(result.current.loaded).toBe(true);
  });

  it('no navegador, mostra o quadro inicial enquanto lê e passa a gravá-lo quando não há nada gravado', async () => {
    const fake = fakeStore('browser');
    const { result, onStoredBoard } = renderStorage({
      store: fake.store,
      board: onScreen,
    });
    expect(result.current).toMatchObject({
      loaded: false,
      phase: { kind: 'ready' },
    });
    expect(result.current.saveActions).toBeUndefined();

    await fake.answerLoad({ kind: 'empty' });

    expect(onStoredBoard).not.toHaveBeenCalled();
    expect(result.current.loaded).toBe(true);
    expect(fake.saved).toEqual([onScreen]);
  });

  it('acompanha a situação da gravação', async () => {
    const fake = fakeStore('remote');
    const { result } = renderStorage({ store: fake.store, board: onScreen });
    await fake.answerLoad({ kind: 'found', board: stored });

    act(() => fake.setStatus({ kind: 'conflict', busy: false }));

    expect(result.current.save).toEqual({ kind: 'conflict', busy: false });
  });

  it('repassa as saídas da gravação e entrega o quadro que o servidor devolveu', async () => {
    const fake = fakeStore('remote');
    const { result, onStoredBoard } = renderStorage({
      store: fake.store,
      board: onScreen,
    });
    await fake.answerLoad({ kind: 'found', board: stored });
    onStoredBoard.mockClear();
    const theirs = titled('Do servidor');
    fake.remote.takeTheirs
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(theirs);

    result.current.saveActions?.retry();
    result.current.saveActions?.keepMine();
    await act(async () => result.current.saveActions?.takeTheirs());
    expect(onStoredBoard).not.toHaveBeenCalled();
    await act(async () => result.current.saveActions?.takeTheirs());

    expect(fake.remote.retry).toHaveBeenCalledTimes(1);
    expect(fake.remote.keepMine).toHaveBeenCalledTimes(1);
    expect(onStoredBoard).toHaveBeenCalledExactlyOnceWith(theirs);
  });

  it('relê na volta para a aba só com tudo gravado', async () => {
    const fake = fakeStore('remote');
    const { onStoredBoard } = renderStorage({
      store: fake.store,
      board: onScreen,
    });
    comeBackToTab();
    expect(fake.remote.refresh).not.toHaveBeenCalled();

    await fake.answerLoad({ kind: 'found', board: stored });
    onStoredBoard.mockClear();
    const fresh = titled('Mais novo');
    fake.remote.refresh.mockResolvedValueOnce(fresh);
    comeBackToTab();
    await act(async () => undefined);
    expect(onStoredBoard).toHaveBeenCalledExactlyOnceWith(fresh);

    act(() => fake.setStatus({ kind: 'pending' }));
    comeBackToTab();
    expect(fake.remote.refresh).toHaveBeenCalledTimes(1);
  });

  it('ao trocar de armazenamento, envia o que esperava no anterior e descarta o que chegar dele', async () => {
    const first = fakeStore('remote');
    const second = fakeStore('remote');
    const { result, rerender, onStoredBoard } = renderStorage({
      store: first.store,
      board: onScreen,
    });
    await first.answerLoad({ kind: 'found', board: stored });
    onStoredBoard.mockClear();
    let answerRefresh: (board: Board) => void = () => undefined;
    first.remote.refresh.mockReturnValueOnce(
      new Promise<Board>((resolve) => {
        answerRefresh = resolve;
      }),
    );
    comeBackToTab();

    rerender({ store: second.store, board: onScreen });
    expect(result.current.phase).toEqual({ kind: 'loading' });
    expect(first.remote.flush).toHaveBeenCalledTimes(1);
    await act(async () => answerRefresh(titled('Atrasado')));

    expect(onStoredBoard).not.toHaveBeenCalled();
    expect(second.saved).toEqual([]);
  });

  it('ao sair da tela, envia o que esperava e ignora a leitura que ainda corria', async () => {
    const fake = fakeStore('remote');
    const { unmount, onStoredBoard } = renderStorage({
      store: fake.store,
      board: onScreen,
    });

    unmount();
    await fake.answerLoad({ kind: 'found', board: stored });

    expect(fake.remote.flush).toHaveBeenCalledTimes(1);
    expect(onStoredBoard).not.toHaveBeenCalled();
  });

  it('o envio pedido pela tela espera o servidor e devolve como a gravação ficou', async () => {
    const fake = fakeStore('remote');
    const { result } = renderStorage({ store: fake.store, board: onScreen });
    await fake.answerLoad({ kind: 'found', board: stored });
    const failed = { kind: 'failed', message: 'Sem rede.', busy: false };
    fake.remote.flush.mockImplementationOnce(async () => {
      fake.setStatus({ kind: 'failed', message: 'Sem rede.', busy: false });
    });

    let status: unknown;
    await act(async () => {
      status = await result.current.flush?.();
    });

    expect(fake.remote.flush).toHaveBeenCalledTimes(1);
    expect(status).toEqual(failed);
  });

  it('o quadro do navegador não tem envio a pedir', async () => {
    const fake = fakeStore('browser');
    const { result } = renderStorage({ store: fake.store, board: onScreen });
    await fake.answerLoad({ kind: 'empty' });

    expect(result.current.flush).toBeUndefined();
  });
});

describe('useBoardStorage: aviso de saída', () => {
  /** Diz se fechar a aba agora passaria pelo aviso de saída do navegador. */
  function leavingWarns(): boolean {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it('avisa ao sair enquanto o quadro do servidor tem mudança esperando, com falha ou em conflito', async () => {
    const fake = fakeStore('remote');
    renderStorage({ store: fake.store, board: onScreen });
    await fake.answerLoad({ kind: 'found', board: stored });
    expect(leavingWarns()).toBe(false);

    act(() => fake.setStatus({ kind: 'pending' }));
    expect(leavingWarns()).toBe(true);

    act(() =>
      fake.setStatus({ kind: 'failed', message: 'Sem rede.', busy: false }),
    );
    expect(leavingWarns()).toBe(true);

    act(() => fake.setStatus({ kind: 'conflict', busy: false }));
    expect(leavingWarns()).toBe(true);
  });

  it('para de avisar quando a gravação termina e quando a tela sai', async () => {
    const fake = fakeStore('remote');
    const { unmount } = renderStorage({ store: fake.store, board: onScreen });
    await fake.answerLoad({ kind: 'found', board: stored });
    act(() => fake.setStatus({ kind: 'pending' }));

    act(() => fake.setStatus({ kind: 'saved' }));
    expect(leavingWarns()).toBe(false);

    act(() => fake.setStatus({ kind: 'pending' }));
    unmount();
    expect(leavingWarns()).toBe(false);
  });

  it('não avisa no quadro do navegador, nem quando a gravação dele falha', async () => {
    const fake = fakeStore('browser');
    renderStorage({ store: fake.store, board: onScreen });
    await fake.answerLoad({ kind: 'empty' });

    act(() =>
      fake.setStatus({ kind: 'failed', message: 'Sem espaço.', busy: false }),
    );

    expect(leavingWarns()).toBe(false);
  });
});

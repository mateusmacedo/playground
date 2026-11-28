import { act, fireEvent, render, screen } from '@testing-library/react';

import { begin } from '@/shared/process/engine-test-kit';
import { linearPlan } from '@/shared/process/engine-test-plans';
import {
  createBrowserRunViewStore,
  type RunView,
  type RunViewStore,
} from '@/shared/process/run-view-store';

import type { BoardCard } from '../model/board';
import { processBoard } from '../model/process-test-data';
import { DEFAULT_BOARD_ID } from '../model/workspace';
import type { SaveStatus } from '../store/board-store';
import { ProcessBoardProvider } from '../use-process-board';
import { RUN_NOT_SAVED, RUN_VIEW_REFUSED } from '../use-run-diagram';
import { ProcessDiagramLink } from './process-diagram-link';

const NOW = '2026-11-26T12:00:00.000Z';
const WAITING_TEXT = 'Gravando o quadro antes de abrir…';

const run = begin(linearPlan);
const card: BoardCard = { id: 'c1', title: 'Card c1', number: 7, process: run };
const board = processBoard({ todo: [card] });

/** O que o navegador faria com cada clique no link, na ordem: `true` quando seguiria o endereço. */
let followed: boolean[] = [];

function recordClick(event: MouseEvent): void {
  followed.push(!event.defaultPrevented);
  // NOTE: o jsdom não navega e reclama quando tentam; o clique é segurado aqui, depois de a tela já ter decidido.
  event.preventDefault();
}

/** Porta simulada: guarda o que recebeu e responde, a cada gravação, o que o teste combinou. */
function fakeStore(...answers: boolean[]) {
  const saved: RunView[] = [];
  const store: RunViewStore = {
    load: () => null,
    save: (view) => {
      saved.push(view);
      return answers.shift() ?? true;
    },
  };
  return { store, saved };
}

/** A espera pela gravação do quadro no servidor, que o teste termina com a situação que quiser. */
function heldFlush() {
  const finishers: ((status: SaveStatus) => void)[] = [];
  const flush = vi.fn(
    () =>
      new Promise<SaveStatus>((resolve) => {
        finishers.push(resolve);
      }),
  );
  return {
    flush,
    finish: async (status: SaveStatus) => {
      await act(async () => {
        finishers.shift()?.(status);
      });
    },
  };
}

interface RenderLinkParams {
  readonly store?: RunViewStore;
  /** Com ela, o quadro é gravado num servidor. */
  readonly flush?: () => Promise<SaveStatus>;
}

function renderLink(params: RenderLinkParams = {}) {
  return render(
    <ProcessBoardProvider board={board} flush={params.flush}>
      <ProcessDiagramLink
        card={card}
        run={run}
        keyPrefix="QD"
        store={params.store}
      />
    </ProcessBoardProvider>,
  );
}

function link(): HTMLAnchorElement {
  return screen.getByRole<HTMLAnchorElement>('link', { name: 'Ver diagrama' });
}

function middleClick(target: HTMLElement): void {
  fireEvent(
    target,
    new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
  );
}

beforeEach(() => {
  followed = [];
  document.addEventListener('click', recordClick);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  window.history.replaceState(null, '', '/quadro?quadro=b7');
});

afterEach(() => {
  document.removeEventListener('click', recordClick);
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('ProcessDiagramLink: quadro gravado no navegador', () => {
  it('aponta para a página do diagrama, com o quadro e o card da execução', () => {
    renderLink();

    const address = new URL(link().href);

    expect(address.pathname).toBe('/processos/execucao');
    expect(address.searchParams.get('ref')).toBe('b7:c1');
  });

  it('sem quadro no endereço da página, aponta para o quadro principal', () => {
    window.history.replaceState(null, '', '/quadro');
    renderLink();

    const address = new URL(link().href);

    expect(address.searchParams.get('ref')).toBe(`${DEFAULT_BOARD_ID}:c1`);
  });

  it('guarda a situação da execução, com o caminho de volta ao card, e deixa o link seguir', () => {
    const { store, saved } = fakeStore();
    renderLink({ store });

    fireEvent.click(link());

    expect(followed).toEqual([true]);
    expect(saved).toEqual([
      {
        ref: 'b7:c1',
        definitionId: run.definitionId,
        version: run.version,
        processName: 'Processo',
        cardLabel: 'QD-7 Card c1',
        backHref: '/quadro?quadro=b7&card=QD-7',
        run,
        savedAt: NOW,
      },
    ]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sem outra porta, guarda a situação no navegador', () => {
    renderLink();

    fireEvent.click(link());

    expect(followed).toEqual([true]);
    expect(createBrowserRunViewStore().load('b7:c1')).toMatchObject({
      cardLabel: 'QD-7 Card c1',
      backHref: '/quadro?quadro=b7&card=QD-7',
    });
  });

  it('avisa e não segue quando o navegador recusa guardar a situação', () => {
    const { store } = fakeStore(false);
    renderLink({ store });

    fireEvent.click(link());

    expect(followed).toEqual([false]);
    expect(screen.getByRole('alert').textContent).toBe(RUN_VIEW_REFUSED);
  });

  it('com o armazenamento do navegador bloqueado, avisa em vez de abrir o diagrama', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    renderLink();

    fireEvent.click(link());

    expect(followed).toEqual([false]);
    expect(screen.getByRole('alert').textContent).toBe(RUN_VIEW_REFUSED);
  });

  it('tira o aviso e segue quando a situação volta a ser guardada', () => {
    const { store } = fakeStore(false, true);
    renderLink({ store });
    fireEvent.click(link());

    fireEvent.click(link());

    expect(followed).toEqual([false, true]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('no clique do meio, que abre outra aba, guarda a situação', () => {
    const { store, saved } = fakeStore();
    renderLink({ store });

    middleClick(link());

    expect(saved).toHaveLength(1);
  });
});

describe('ProcessDiagramLink: quadro gravado no servidor', () => {
  it('segura o clique, diz que está gravando e segue quando a gravação termina', async () => {
    const held = heldFlush();
    renderLink({ store: fakeStore().store, flush: held.flush });

    fireEvent.click(link());

    expect(followed).toEqual([false]);
    expect(held.flush).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toBe(WAITING_TEXT);
    expect(link().getAttribute('aria-disabled')).toBe('true');

    await held.finish({ kind: 'saved' });

    expect(followed).toEqual([false, true]);
    expect(screen.getByRole('status').textContent).toBe('');
    expect(link().hasAttribute('aria-disabled')).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ignora o clique repetido enquanto a gravação corre', async () => {
    const held = heldFlush();
    renderLink({ store: fakeStore().store, flush: held.flush });
    fireEvent.click(link());

    fireEvent.click(link());

    expect(held.flush).toHaveBeenCalledTimes(1);
    await held.finish({ kind: 'saved' });
    expect(followed).toEqual([false, false, true]);
  });

  it.each<[string, SaveStatus]>([
    ['falha', { kind: 'failed', message: 'Sem conexão.', busy: false }],
    ['conflito', { kind: 'conflict', busy: false }],
  ])(
    'não segue e diz por quê quando a gravação termina em %s',
    async (_name, status) => {
      const held = heldFlush();
      renderLink({ store: fakeStore().store, flush: held.flush });
      fireEvent.click(link());

      await held.finish(status);

      expect(followed).toEqual([false]);
      expect(screen.getByRole('alert').textContent).toBe(RUN_NOT_SAVED);
      expect(screen.getByRole('status').textContent).toBe('');
    },
  );

  it('no clique seguinte, tira o aviso, espera de novo e segue quando a gravação dá certo', async () => {
    const held = heldFlush();
    renderLink({ store: fakeStore().store, flush: held.flush });
    fireEvent.click(link());
    await held.finish({ kind: 'failed', message: 'Sem conexão.', busy: false });

    fireEvent.click(link());

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe(WAITING_TEXT);
    await held.finish({ kind: 'saved' });
    expect(held.flush).toHaveBeenCalledTimes(2);
    expect(followed).toEqual([false, false, true]);
  });

  it('segue mesmo quando o navegador recusa guardar a situação, porque o diagrama lê o servidor', async () => {
    const held = heldFlush();
    renderLink({ store: fakeStore(false).store, flush: held.flush });
    fireEvent.click(link());

    await held.finish({ kind: 'saved' });

    expect(followed).toEqual([false, true]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['Ctrl', 'ctrlKey'],
    ['Command', 'metaKey'],
    ['Shift', 'shiftKey'],
  ] as const)(
    'com a tecla %s, deixa o navegador abrir em outro lugar e manda gravar sem esperar',
    (_name, key) => {
      const held = heldFlush();
      const { store, saved } = fakeStore();
      renderLink({ store, flush: held.flush });

      fireEvent.click(link(), { [key]: true });

      expect(followed).toEqual([true]);
      expect(saved).toHaveLength(1);
      expect(held.flush).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status').textContent).toBe('');
    },
  );

  it('no clique do meio, guarda a situação e manda gravar', () => {
    const held = heldFlush();
    const { store, saved } = fakeStore();
    renderLink({ store, flush: held.flush });

    middleClick(link());

    expect(saved).toHaveLength(1);
    expect(held.flush).toHaveBeenCalledTimes(1);
  });

  it('não abre o diagrama quando o link saiu da tela durante a espera', async () => {
    const held = heldFlush();
    const view = renderLink({ store: fakeStore().store, flush: held.flush });
    fireEvent.click(link());
    view.unmount();

    await held.finish({ kind: 'saved' });

    expect(followed).toEqual([false]);
  });
});

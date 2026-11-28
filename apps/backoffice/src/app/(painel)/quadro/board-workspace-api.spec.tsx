import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { API_ERROR_MESSAGES } from '@/shared/api/api-result';
import type { PanelApi } from '@/shared/api/panel-api';
import { PanelApiProvider } from '@/shared/api/panel-api-context';

import { BoardWorkspace } from './board-workspace';
import type { Board } from './model/board';
import { createBoard } from './model/board-state';
import { sampleLabels, sampleLanes } from './model/sample-board';
import { BOARD_STORAGE_KEY } from './model/storage';
import {
  ACTIVE_BOARD_STORAGE_KEY,
  BOARDS_STORAGE_KEY,
} from './model/workspace';
import { StorageHint } from './storage-hint';
import {
  createFakeBoardsApi,
  type FakeBoardsApi,
  storedDocument,
} from './store/boards-api-test-kit';
import { UNREADABLE_BOARD } from './store/http-board-store';

/** Espera padrão entre a mudança do quadro e o envio. */
const WRITE_DELAY = 400;

function titled(title: string): Board {
  return createBoard({ lanes: [{ id: 'lane-1', title, cards: [] }] });
}

interface ServerBoard {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly revision?: number;
}

function putOnServer(api: FakeBoardsApi, board: ServerBoard): void {
  const { id, name, title, revision = 1 } = board;
  api.documents.set(
    id,
    storedDocument({ id, name, revision, board: titled(title) }),
  );
}

/** Servidor simulado com o quadro principal, de coluna "No servidor". */
function serverWithMainBoard(): FakeBoardsApi {
  const api = createFakeBoardsApi();
  putOnServer(api, { id: 'board-1', name: 'Principal', title: 'No servidor' });
  return api;
}

function renderWorkspace(api: FakeBoardsApi) {
  const panelApi: PanelApi = {
    boards: api,
    processDefinitions: {} as PanelApi['processDefinitions'],
  };
  return render(
    <PanelApiProvider value={panelApi}>
      <StorageHint />
      <BoardWorkspace sampleLanes={sampleLanes} sampleLabels={sampleLabels} />
    </PanelApiProvider>,
  );
}

/** Avança o relógio simulado e deixa o React aplicar o que as chamadas à API mudaram. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function openWorkspace(api: FakeBoardsApi) {
  const view = renderWorkspace(api);
  await advance(0);
  return view;
}

function addLane(title: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar coluna' }));
  const input = screen.getByRole('textbox', { name: 'Nome da nova coluna' });
  fireEvent.change(input, { target: { value: title } });
  fireEvent.submit(input);
}

function serverLaneTitles(api: FakeBoardsApi): readonly string[] {
  const board = api.documents.get('board-1')?.board as Board | undefined;
  return board?.lanes.map((lane) => lane.title) ?? [];
}

function comeBackToTab() {
  act(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
  });
}

describe('BoardWorkspace com a API ligada', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/quadro');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('mostra a espera e depois os quadros e o quadro aberto que vêm do servidor', async () => {
    const api = serverWithMainBoard();
    putOnServer(api, { id: 'board-2', name: 'Vendas', title: 'Propostas' });

    renderWorkspace(api);
    expect(screen.getByText('Carregando os quadros…')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Quadro' })).toBeNull();
    await advance(0);

    expect(screen.getByRole('option', { name: 'Principal' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Vendas' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'No servidor' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'A fazer' })).toBeNull();
    expect(screen.getByText('Em teste: pode mudar.')).toBeTruthy();
  });

  it('guarda no navegador só o quadro aberto por último, não a lista nem o conteúdo', async () => {
    const api = serverWithMainBoard();

    await openWorkspace(api);
    addLane('Revisão');
    await advance(WRITE_DELAY);

    expect(localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY)).toBe('board-1');
    expect(localStorage.getItem(BOARDS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(BOARD_STORAGE_KEY)).toBeNull();
  });

  it('abre o quadro pedido no endereço, com a espera dele', async () => {
    const api = serverWithMainBoard();
    putOnServer(api, { id: 'board-2', name: 'Vendas', title: 'Propostas' });
    window.history.replaceState(null, '', '/quadro?quadro=board-2');

    renderWorkspace(api);
    const releaseBoard = api.holdNext();
    await advance(0);
    expect(screen.getByText('Carregando o quadro…')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Quadro' })).toBeTruthy();
    releaseBoard();
    await advance(0);

    expect(screen.getByRole('region', { name: 'Propostas' })).toBeTruthy();
  });

  it('mostra o erro da leitura da lista e lê de novo com "Tentar de novo"', async () => {
    const api = serverWithMainBoard();
    api.failNext('network');

    await openWorkspace(api);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(
      'Não foi possível carregar os quadros.',
    );
    expect(alert.textContent).toContain(API_ERROR_MESSAGES.network);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await advance(0);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('region', { name: 'No servidor' })).toBeTruthy();
  });

  it('mostra o erro da leitura do quadro e lê de novo com "Tentar de novo"', async () => {
    const api = serverWithMainBoard();
    const document = api.documents.get('board-1');
    api.documents.set('board-1', { ...document, board: 'estragado' } as never);

    await openWorkspace(api);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Não foi possível carregar o quadro.');
    expect(alert.textContent).toContain(UNREADABLE_BOARD);
    expect(screen.getByRole('combobox', { name: 'Quadro' })).toBeTruthy();

    putOnServer(api, { id: 'board-1', name: 'Principal', title: 'Consertado' });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await advance(0);

    expect(screen.getByRole('region', { name: 'Consertado' })).toBeTruthy();
  });

  it('mostra a mudança na hora e a grava no servidor depois da espera', async () => {
    const api = serverWithMainBoard();
    await openWorkspace(api);

    addLane('Revisão');
    expect(screen.getByRole('region', { name: 'Revisão' })).toBeTruthy();
    expect(serverLaneTitles(api)).toEqual(['No servidor']);
    await advance(WRITE_DELAY);

    expect(serverLaneTitles(api)).toEqual(['No servidor', 'Revisão']);
    expect(api.documents.get('board-1')?.revision).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('avisa a falha da gravação, mantém a mudança na tela e grava com "Tentar de novo"', async () => {
    const api = serverWithMainBoard();
    await openWorkspace(api);
    api.failNext('server');

    addLane('Revisão');
    await advance(WRITE_DELAY);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(
      'As últimas mudanças ainda não foram gravadas no servidor',
    );
    expect(alert.textContent).toContain(API_ERROR_MESSAGES.server);
    expect(screen.getByRole('region', { name: 'Revisão' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await advance(0);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(serverLaneTitles(api)).toEqual(['No servidor', 'Revisão']);
  });

  it('no conflito, "Recarregar do servidor" troca a tela pela versão de lá', async () => {
    const api = serverWithMainBoard();
    await openWorkspace(api);
    putOnServer(api, {
      id: 'board-1',
      name: 'Principal',
      title: 'De outra pessoa',
      revision: 2,
    });

    addLane('Minha');
    await advance(WRITE_DELAY);
    expect(screen.getByRole('alert').textContent).toContain(
      'Este quadro foi alterado em outro lugar depois que você o abriu',
    );
    expect(screen.getByRole('region', { name: 'Minha' })).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Recarregar do servidor' }),
    );
    await advance(0);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.getByRole('region', { name: 'De outra pessoa' }),
    ).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Minha' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Desfazer/ })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('no conflito, "Manter a minha versão" grava a tela por cima do servidor', async () => {
    const api = serverWithMainBoard();
    await openWorkspace(api);
    putOnServer(api, {
      id: 'board-1',
      name: 'Principal',
      title: 'De outra pessoa',
      revision: 2,
    });
    addLane('Minha');
    await advance(WRITE_DELAY);

    fireEvent.click(
      screen.getByRole('button', { name: 'Manter a minha versão' }),
    );
    await advance(0);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(serverLaneTitles(api)).toEqual(['No servidor', 'Minha']);
    expect(api.documents.get('board-1')?.revision).toBe(3);
  });

  it('relê o quadro e a lista quando a pessoa volta para a aba', async () => {
    const api = serverWithMainBoard();
    await openWorkspace(api);
    putOnServer(api, {
      id: 'board-1',
      name: 'Principal',
      title: 'De outra pessoa',
      revision: 2,
    });
    putOnServer(api, { id: 'board-5', name: 'Novo de lá', title: 'Outra' });

    comeBackToTab();
    await advance(0);

    expect(
      screen.getByRole('region', { name: 'De outra pessoa' }),
    ).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Novo de lá' })).toBeTruthy();
  });

  it('não relê na volta para a aba enquanto há mudança por gravar', async () => {
    const api = serverWithMainBoard();
    await openWorkspace(api);
    addLane('Minha');
    api.calls.length = 0;

    comeBackToTab();
    await advance(0);

    expect(api.calls).toEqual([]);
    expect(screen.getByRole('region', { name: 'Minha' })).toBeTruthy();
  });

  it('avisa quando o servidor não exclui o quadro, que volta para a lista', async () => {
    const api = serverWithMainBoard();
    putOnServer(api, { id: 'board-2', name: 'Vendas', title: 'Propostas' });
    await openWorkspace(api);
    api.failNext('server');

    fireEvent.click(screen.getByRole('button', { name: 'Excluir quadro' }));
    await advance(500);
    const dialog = screen.getByRole('dialog', {
      name: 'Excluir o quadro Principal',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await advance(500);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(
      `Não foi possível excluir o quadro Principal. ${API_ERROR_MESSAGES.server}`,
    );
    expect(screen.getByRole('option', { name: 'Principal' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Propostas' })).toBeTruthy();

    fireEvent.click(within(alert).getByRole('button', { name: 'Close' }));
    await advance(500);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cria o quadro padrão, com o exemplo, quando o servidor não tem nenhum', async () => {
    const api = createFakeBoardsApi();

    await openWorkspace(api);
    await advance(WRITE_DELAY);

    expect(
      screen.getByRole('option', { name: 'Quadro principal' }),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Em andamento' })).toBeTruthy();
    expect(api.documents.get('board-1')).toMatchObject({
      name: 'Quadro principal',
      revision: 1,
    });
    expect(serverLaneTitles(api)).toEqual([
      'A fazer',
      'Em andamento',
      'Concluído',
    ]);
  });
});

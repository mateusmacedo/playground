import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import {
  deliveryRun,
  storeBoards,
  testBoard,
} from '@/shared/process/board-runs-test-kit';
import {
  createBrowserRunViewStore,
  type RunView,
} from '@/shared/process/run-view-store';

import { RunsView } from './runs-view';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function openAddress(search: string): void {
  window.history.replaceState(null, '', `/processos/execucao${search}`);
}

function pageTitle(name: string) {
  return screen.findByRole('heading', { level: 1, name });
}

/** Situação gravada pelo quadro para a execução de um card; sem o desenho no catálogo, a página diz de que processo é. */
function saveView(overrides: Pick<RunView, 'ref' | 'processName'>): void {
  const run = deliveryRun();
  createBrowserRunViewStore().save({
    definitionId: run.definitionId,
    version: run.version,
    cardLabel: 'QD-1 Atender o pedido',
    backHref: '/quadro?card=QD-1',
    run,
    savedAt: '2026-11-26T12:00:00.000Z',
    ...overrides,
  });
}

describe('RunsView', () => {
  afterEach(() => {
    openAddress('');
    window.localStorage.clear();
  });

  it('na primeira renderização, igual à do servidor, mostra o título da lista e o carregamento', () => {
    openAddress('?ref=board-1:card-1');

    const html = renderToString(<RunsView />);

    expect(html).toContain('Execuções');
    expect(html).toContain('Carregando…');
    expect(html).not.toContain('Execução do processo');
  });

  it('sem execução indicada no endereço, mostra a lista das execuções em andamento', async () => {
    const card = {
      id: 'card-1',
      number: 1,
      title: 'Atender o pedido',
      process: deliveryRun(),
    };
    storeBoards([
      { id: 'board-1', name: 'Vendas', board: testBoard({ cards: [card] }) },
    ]);
    openAddress('');

    render(<RunsView />);

    expect(await pageTitle('Execuções')).toBeTruthy();
    expect(
      await screen.findByRole('table', { name: 'Execuções em andamento' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: 'Todas as execuções' }),
    ).toBeNull();
  });

  it('com a referência vazia no endereço, também mostra a lista', async () => {
    openAddress('?ref=');

    render(<RunsView />);

    expect(await pageTitle('Execuções')).toBeTruthy();
    expect(
      await screen.findByText('Nenhuma execução em andamento.'),
    ).toBeTruthy();
  });

  it('com a execução indicada no endereço, mostra o diagrama dela e o link para a lista', async () => {
    openAddress('?ref=board-1:card-1');

    render(<RunsView />);

    expect(await pageTitle('Execução do processo')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Todas as execuções' })
        .getAttribute('href'),
    ).toBe('/processos/execucao');
    expect((await screen.findByRole('alert')).textContent).toContain(
      'A situação desta execução não está neste navegador.',
    );
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('troca a lista pelo diagrama quando o endereço passa a indicar uma execução, sem recarregar', async () => {
    openAddress('');
    const { rerender } = render(<RunsView />);
    await pageTitle('Execuções');
    openAddress('?ref=board-1:card-1');

    rerender(<RunsView />);

    expect(await pageTitle('Execução do processo')).toBeTruthy();
    expect(screen.queryByText('Nenhuma execução em andamento.')).toBeNull();
  });

  it('leva o foco ao título quando a lista dá lugar ao diagrama e quando o diagrama dá lugar à lista', async () => {
    openAddress('');
    const { rerender } = render(<RunsView />);
    await pageTitle('Execuções');
    expect(document.activeElement).toBe(document.body);

    openAddress('?ref=board-1:card-1');
    rerender(<RunsView />);
    const diagramTitle = await pageTitle('Execução do processo');
    expect(document.activeElement).toBe(diagramTitle);

    openAddress('');
    rerender(<RunsView />);
    const listTitle = await pageTitle('Execuções');
    expect(document.activeElement).toBe(listTitle);
  });

  it('não tira o foco de onde está quando a página abre já no diagrama', async () => {
    openAddress('?ref=board-1:card-1');
    render(<RunsView />);

    await pageTitle('Execução do processo');

    expect(document.activeElement).toBe(document.body);
  });

  it('volta para a lista quando o endereço deixa de indicar a execução', async () => {
    openAddress('?ref=board-1:card-1');
    const { rerender } = render(<RunsView />);
    await pageTitle('Execução do processo');
    openAddress('');

    rerender(<RunsView />);

    expect(await pageTitle('Execuções')).toBeTruthy();
    expect(
      await screen.findByText('Nenhuma execução em andamento.'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: 'Todas as execuções' }),
    ).toBeNull();
  });

  it('lê a outra execução quando o endereço troca de uma para outra', async () => {
    saveView({ ref: 'board-1:card-1', processName: 'Compras' });
    saveView({ ref: 'board-1:card-2', processName: 'Vendas' });
    openAddress('?ref=board-1:card-1');
    const { rerender } = render(<RunsView />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'O desenho da versão 1 de Compras não está neste navegador.',
    );
    openAddress('?ref=board-1:card-2');

    rerender(<RunsView />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'O desenho da versão 1 de Vendas não está neste navegador.',
    );
  });
});

import { render, screen } from '@testing-library/react';

import ProcessRunsPage, { metadata } from './page';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function openAddress(search: string): void {
  window.history.replaceState(null, '', `/processos/execucao${search}`);
}

describe('ProcessRunsPage', () => {
  afterEach(() => {
    openAddress('');
    window.localStorage.clear();
  });

  it('dá à aba o título da página', () => {
    expect(metadata.title).toBe('Execuções');
  });

  it('sem execução indicada no endereço, mostra o cabeçalho da lista e a lista', async () => {
    openAddress('');

    render(<ProcessRunsPage />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Execuções' }),
    ).toBeTruthy();
    expect(
      await screen.findByText('Nenhuma execução em andamento.'),
    ).toBeTruthy();
    const board = screen.getByRole('link', { name: 'Ir para o quadro' });
    expect(board.getAttribute('href')).toBe('/quadro');
  });

  it('com a execução indicada no endereço, mostra o cabeçalho do diagrama e a volta para a lista', async () => {
    openAddress('?ref=board-1:card-1');

    render(<ProcessRunsPage />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Execução do processo',
      }),
    ).toBeTruthy();
    const all = screen.getByRole('link', { name: 'Todas as execuções' });
    expect(all.getAttribute('href')).toBe('/processos/execucao');
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});

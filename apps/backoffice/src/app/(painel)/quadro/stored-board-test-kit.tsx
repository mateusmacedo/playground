import { fireEvent, render, screen, within } from '@testing-library/react';

import { KanbanBoard } from './kanban-board';
import type { Board } from './model/board';
import { serializeBoard } from './model/storage';

/** Chave do quadro gravado nos testes de tela; cada teste limpa o `localStorage` ao terminar. */
export const TEST_BOARD_KEY = 'quadro:teste-de-tela';

/**
 * Monta o quadro a partir de um quadro gravado no navegador e espera a leitura, que termina quando o primeiro card
 * do quadro aparece, em qualquer visão. É o caminho para testar a tela com o que as colunas iniciais não levam:
 * coluna de conclusão, regras e processos.
 */
export async function renderStoredBoard(board: Board): Promise<void> {
  localStorage.setItem(TEST_BOARD_KEY, serializeBoard(board));
  render(<KanbanBoard initialLanes={[]} storageKey={TEST_BOARD_KEY} />);
  await screen.findAllByText(board.lanes[0].cards[0].title);
}

/** O card na visão em colunas. */
export function cardItem(title: string): HTMLElement {
  return screen
    .getByRole('heading', { level: 3, name: title })
    .closest('li') as HTMLElement;
}

export function openCard(title: string): void {
  fireEvent.click(within(cardItem(title)).getByRole('button', { name: title }));
}

export function detailsPanel(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Detalhes do card' });
}

/** Último texto anunciado ao leitor de tela. */
export function announcement(): string | null | undefined {
  return screen.getByRole('status', { name: 'Avisos do quadro' }).textContent;
}

/** Troca a visão pela barra do quadro. */
export function showView(name: 'Quadro' | 'Lista' | 'Etapas'): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

/** Títulos dos cards da tabela, linha a linha, na ordem da tela; cada linha tem um só botão que abre o card. */
export function tableCardTitles(): (string | null)[] {
  const titles = screen
    .getByRole('table')
    .querySelectorAll('tbody [data-card-open]');
  return Array.from(titles, (title) => title.textContent);
}

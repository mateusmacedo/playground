import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { KanbanBoard } from './kanban-board';
import type { BoardLabel, BoardLane } from './model/board';

const labels: readonly BoardLabel[] = [
  { id: 'l1', name: 'Urgente', color: 'danger' },
  { id: 'l2', name: 'Ideia', color: 'info' },
];

const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'a', title: 'Revisão do contrato', labelIds: ['l1'] },
      { id: 'b', title: 'Outro', description: 'Ação pendente' },
    ],
  },
  {
    id: 'doing',
    title: 'Em andamento',
    cards: [{ id: 'c', title: 'Item C', labelIds: ['l2'] }],
  },
  { id: 'done', title: 'Concluído', cards: [] },
];

function lane(name: string) {
  return screen.getByRole('region', { name });
}

function cardItem(title: string): HTMLElement {
  return screen
    .getByRole('heading', { level: 3, name: title })
    .closest('li') as HTMLElement;
}

function dimmed(title: string): boolean {
  return cardItem(title).classList.contains('kanban-card--dimmed');
}

function filterMenu(): HTMLElement {
  return document.querySelector('.kanban-label-filter') as HTMLElement;
}

function renderBoard() {
  render(<KanbanBoard initialLanes={lanes} initialLabels={labels} />);
}

describe('KanbanBoard: encontrar cards', () => {
  it('esmaece os cards fora da busca, sem acento nem maiúscula, e mostra a contagem', () => {
    renderBoard();
    const search = screen.getByRole('searchbox', { name: 'Buscar cards' });
    fireEvent.change(search, { target: { value: 'ACAO' } });

    expect(dimmed('Outro')).toBe(false);
    expect(dimmed('Revisão do contrato')).toBe(true);
    expect(screen.getByText('1 de 3 cards')).toBeTruthy();
    expect(within(cardItem('Item C')).getByText('Fora da busca.')).toBeTruthy();

    fireEvent.change(search, { target: { value: 'urgente' } });
    expect(dimmed('Revisão do contrato')).toBe(false);

    fireEvent.keyDown(search, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/de 3 cards/)).toBeNull();
    fireEvent.keyDown(search, { key: 'Escape' });
  });

  it('vai para a busca com a barra, mas não dentro de um campo', () => {
    renderBoard();
    const search = screen.getByRole('searchbox', { name: 'Buscar cards' });
    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(search);

    fireEvent.click(
      within(lane('Concluído')).getByRole('button', { name: 'Adicionar card' }),
    );
    const input = screen.getByRole('textbox', {
      name: 'Título do novo card em Concluído',
    });
    fireEvent.keyDown(input, { key: '/' });
    expect(document.activeElement).toBe(input);
  });

  it('filtra por etiqueta, limpa o filtro e leva ao catálogo', async () => {
    renderBoard();
    fireEvent.click(screen.getByRole('button', { name: /^Etiquetas/ }));
    fireEvent.click(
      within(filterMenu()).getByRole('checkbox', { name: 'Ideia' }),
    );

    expect(dimmed('Item C')).toBe(false);
    expect(dimmed('Outro')).toBe(true);
    expect(
      screen.getByRole('button', { name: /^Etiquetas/ }).textContent,
    ).toContain('1 no filtro');

    fireEvent.click(
      within(filterMenu()).getByRole('checkbox', { name: 'Urgente' }),
    );
    expect(dimmed('Revisão do contrato')).toBe(false);
    fireEvent.click(
      within(filterMenu()).getByRole('checkbox', { name: 'Urgente' }),
    );
    expect(dimmed('Revisão do contrato')).toBe(true);

    fireEvent.click(
      within(filterMenu()).getByRole('button', { name: 'Limpar filtro' }),
    );
    expect(dimmed('Outro')).toBe(false);

    fireEvent.click(
      within(filterMenu()).getByRole('button', { name: 'Gerenciar etiquetas' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Etiquetas do quadro' }),
    ).toBeTruthy();
  });

  it('avisa quando o quadro não tem etiquetas', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    expect(
      within(filterMenu()).getByText('Nenhuma etiqueta no quadro.'),
    ).toBeTruthy();
  });

  it('recolhe e expande a coluna, com o foco no título dela', async () => {
    renderBoard();
    fireEvent.click(
      screen.getByRole('button', { name: 'Ações da coluna Concluído' }),
    );
    fireEvent.click(
      within(lane('Concluído')).getByRole('button', {
        name: 'Recolher coluna',
      }),
    );

    expect(lane('Concluído').classList.contains('kanban-lane--collapsed')).toBe(
      true,
    );
    expect(
      within(lane('Concluído')).queryByRole('button', {
        name: 'Adicionar card',
      }),
    ).toBeNull();
    expect(document.querySelector('[aria-live="assertive"]')?.textContent).toBe(
      'Coluna Concluído recolhida.',
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(lane('Concluído')).getByRole('heading', { level: 2 }),
      ),
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Expandir a coluna Concluído' }),
    );
    expect(lane('Concluído').classList.contains('kanban-lane--collapsed')).toBe(
      false,
    );
    expect(document.querySelector('[aria-live="assertive"]')?.textContent).toBe(
      'Coluna Concluído expandida.',
    );
  });

  it('expande a coluna recolhida que recebe um card pelo teclado', () => {
    renderBoard();
    fireEvent.click(
      screen.getByRole('button', { name: 'Ações da coluna Concluído' }),
    );
    fireEvent.click(
      within(lane('Concluído')).getByRole('button', {
        name: 'Recolher coluna',
      }),
    );

    const handle = screen.getByRole('button', { name: 'Mover Item C' });
    fireEvent.click(handle);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });

    expect(lane('Concluído').classList.contains('kanban-lane--collapsed')).toBe(
      false,
    );
    expect(
      within(lane('Concluído')).getAllByRole('heading', { level: 3 })[0]
        ?.textContent,
    ).toBe('Item C');
    // NOTE: na troca de coluna o card remonta; a alça com o foco é a nova.
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Mover Item C' }),
    );
  });

  it('aceita card arrastado para a coluna recolhida e destaca a faixa', () => {
    renderBoard();
    fireEvent.click(
      screen.getByRole('button', { name: 'Ações da coluna Concluído' }),
    );
    fireEvent.click(
      within(lane('Concluído')).getByRole('button', {
        name: 'Recolher coluna',
      }),
    );
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: 'none',
      dropEffect: 'none',
    };
    const fire = (kind: 'dragStart' | 'dragOver' | 'drop', element: Element) =>
      fireEvent(element, createEvent[kind](element, { dataTransfer }));

    fire('dragStart', cardItem('Outro'));
    fire('dragOver', lane('Concluído'));
    expect(
      lane('Concluído').classList.contains('kanban-lane--drop-target'),
    ).toBe(true);
    fire('drop', lane('Concluído'));

    expect(lane('Concluído').textContent).toContain('1');
    expect(
      within(lane('A fazer')).queryByRole('heading', { name: 'Outro' }),
    ).toBeNull();
  });
});

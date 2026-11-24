import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { KanbanBoard } from './kanban-board';
import type { BoardLabel, BoardLane } from './model/board';
import { createBoard } from './model/board-state';
import { BOARD_STORAGE_KEY, serializeBoard } from './model/storage';

const labels: readonly BoardLabel[] = [
  { id: 'l1', name: 'Urgente', color: 'danger' },
];

const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'a', title: 'Item A', labelIds: ['l1'] },
      { id: 'b', title: 'Item B' },
    ],
  },
];

function cardItem(title: string): HTMLElement {
  return screen
    .getByRole('heading', { level: 3, name: title })
    .closest('li') as HTMLElement;
}

function openCard(title: string) {
  fireEvent.click(within(cardItem(title)).getByRole('button', { name: title }));
}

function panel() {
  return screen.getByRole('dialog', { name: 'Detalhes do card' });
}

function renderBoard() {
  render(<KanbanBoard initialLanes={lanes} initialLabels={labels} />);
}

describe('KanbanBoard: dados do card', () => {
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  it('mostra o código de cada card na ordem do quadro', () => {
    renderBoard();
    expect(within(cardItem('Item A')).getByText('QD-1')).toBeTruthy();
    expect(within(cardItem('Item B')).getByText('QD-2')).toBeTruthy();
  });

  it('marca, desmarca e cria etiquetas no painel', () => {
    renderBoard();
    openCard('Item B');
    const field = within(panel()).getByRole('group', { name: 'Etiquetas' });
    fireEvent.click(within(field).getByRole('checkbox', { name: 'Urgente' }));
    expect(within(cardItem('Item B')).getByText('Urgente')).toBeTruthy();
    fireEvent.click(within(field).getByRole('checkbox', { name: 'Urgente' }));
    expect(within(cardItem('Item B')).queryByText('Urgente')).toBeNull();

    const name = within(field).getByRole('textbox', {
      name: 'Nome da nova etiqueta',
    });
    fireEvent.submit(name);
    expect(within(field).getByText('Dê um nome à etiqueta.')).toBeTruthy();
    fireEvent.change(name, { target: { value: 'urgente' } });
    fireEvent.submit(name);
    expect(
      within(field).getByText('Já existe uma etiqueta com esse nome.'),
    ).toBeTruthy();

    fireEvent.change(name, { target: { value: 'Ideia' } });
    fireEvent.change(
      within(field).getByRole('combobox', { name: 'Cor da nova etiqueta' }),
      {
        target: { value: 'info' },
      },
    );
    fireEvent.submit(name);
    expect(within(cardItem('Item B')).getByText('Ideia').className).toContain(
      'text-bg-info',
    );
    expect((name as HTMLInputElement).value).toBe('');
  });

  it('renomeia, recolore, cria e exclui etiquetas no catálogo', async () => {
    renderBoard();
    fireEvent.click(screen.getByRole('button', { name: /^Etiquetas/ }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Gerenciar etiquetas' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Etiquetas do quadro',
    });

    const nameField = within(dialog).getByRole('textbox', {
      name: 'Nome da etiqueta Urgente',
    });
    fireEvent.change(nameField, { target: { value: '' } });
    expect(within(cardItem('Item A')).getByText('Urgente')).toBeTruthy();
    fireEvent.change(nameField, { target: { value: 'Crítica' } });
    expect(within(cardItem('Item A')).getByText('Crítica')).toBeTruthy();
    fireEvent.blur(nameField);

    fireEvent.change(
      within(dialog).getByRole('combobox', { name: 'Cor da etiqueta Crítica' }),
      {
        target: { value: 'warning' },
      },
    );
    expect(within(cardItem('Item A')).getByText('Crítica').className).toContain(
      'text-bg-warning',
    );

    const newName = within(dialog).getByRole('textbox', {
      name: 'Nome da nova etiqueta',
    });
    fireEvent.change(newName, { target: { value: 'Ideia' } });
    fireEvent.submit(newName);
    expect(
      within(dialog).getByRole('textbox', { name: 'Nome da etiqueta Ideia' }),
    ).toBeTruthy();

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Excluir a etiqueta Crítica',
      }),
    );
    expect(within(cardItem('Item A')).queryByText('Crítica')).toBeNull();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Excluir a etiqueta Ideia' }),
    );
    expect(within(dialog).getByText('Nenhuma etiqueta ainda.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /^Etiquetas/ }),
      ),
    );
  });

  it('define o prazo, mostra a situação e marca como cumprido', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 24, 12));
    renderBoard();
    openCard('Item B');
    const date = within(panel()).getByLabelText('Data do prazo');
    const done = within(panel()).getByRole('checkbox', {
      name: 'Prazo cumprido',
    }) as HTMLInputElement;
    expect(done.disabled).toBe(true);

    fireEvent.change(date, { target: { value: '2026-11-20' } });
    expect(within(panel()).getByText('Atrasado.')).toBeTruthy();
    expect(
      within(cardItem('Item B')).getByText('20 de nov.').closest('.badge')
        ?.className,
    ).toContain('text-bg-danger');

    fireEvent.change(date, { target: { value: '2026-11-24' } });
    expect(within(panel()).getByText('Vence hoje.')).toBeTruthy();

    // NOTE: o CoreUI recria o checkbox quando ele deixa de estar desabilitado; a busca pega o atual.
    fireEvent.click(
      within(panel()).getByRole('checkbox', { name: 'Prazo cumprido' }),
    );
    expect(within(panel()).getByText('Cumprido.')).toBeTruthy();
    expect(within(cardItem('Item B')).getByText(', cumprido')).toBeTruthy();

    fireEvent.change(date, { target: { value: '2026-12-01' } });
    fireEvent.change(date, { target: { value: '' } });
    expect(within(cardItem('Item B')).queryByText(/Prazo:/)).toBeNull();
  });

  it('inclui, marca e remove itens do checklist, com o progresso no card', () => {
    renderBoard();
    openCard('Item B');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Adicionar item' }),
    );
    const input = within(panel()).getByRole('textbox', {
      name: 'Texto do novo item do checklist',
    });
    fireEvent.change(input, { target: { value: 'Passo 1' } });
    fireEvent.submit(input);
    fireEvent.change(input, { target: { value: 'Passo 2' } });
    fireEvent.submit(input);

    expect(within(panel()).getByText('0 de 2')).toBeTruthy();
    expect(
      within(cardItem('Item B')).getByText('Checklist: 0 de 2 itens feitos'),
    ).toBeTruthy();

    fireEvent.click(within(panel()).getByRole('checkbox', { name: 'Passo 1' }));
    fireEvent.click(within(panel()).getByRole('checkbox', { name: 'Passo 2' }));
    expect(within(panel()).getByText('2 de 2')).toBeTruthy();
    expect(
      within(cardItem('Item B'))
        .getByText('Checklist: 2 de 2 itens feitos')
        .closest('.badge')?.className,
    ).toContain('text-bg-success');

    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Remover o item Passo 1' }),
    );
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Remover o item Passo 2' }),
    );
    expect(within(cardItem('Item B')).queryByText(/Checklist:/)).toBeNull();
  });
});

describe('KanbanBoard: endereço do card', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('abre o card do endereço e atualiza o endereço ao abrir e fechar', async () => {
    window.history.replaceState(null, '', '/quadro?card=qd-2');
    renderBoard();

    await waitFor(() =>
      expect(
        (within(panel()).getByLabelText('Título') as HTMLInputElement).value,
      ).toBe('Item B'),
    );
    expect(window.location.search).toBe('?card=QD-2');

    openCard('Item A');
    await waitFor(() => expect(window.location.search).toBe('?card=QD-1'));
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Fechar os detalhes' }),
    );
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('avisa do card do endereço que não existe e abre o arquivado só para leitura', async () => {
    window.history.replaceState(null, '', '/quadro?card=QD-9');
    const { unmount } = render(<KanbanBoard initialLanes={lanes} />);
    expect(
      await screen.findByText('O card QD-9 não existe neste quadro.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(
      screen.queryByText('O card QD-9 não existe neste quadro.'),
    ).toBeNull();
    unmount();

    const stored = createBoard({
      lanes: [{ id: 'todo', title: 'A fazer', cards: [] }],
      archive: [
        {
          id: 'b',
          archivedAt: '2026-11-24T10:00:00Z',
          cards: [
            { laneId: 'todo', card: { id: 'b', title: 'Item B', number: 2 } },
          ],
        },
      ],
    });
    localStorage.setItem(BOARD_STORAGE_KEY, serializeBoard(stored));
    window.history.replaceState(null, '', '/quadro?card=QD-2');
    render(<KanbanBoard initialLanes={lanes} storageKey={BOARD_STORAGE_KEY} />);
    expect(
      await screen.findByRole('dialog', { name: 'Card arquivado QD-2' }),
    ).toBeTruthy();
    localStorage.clear();
  });

  it('copia o link do card quando o navegador deixa, e avisa quando não deixa', async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('negado'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderBoard();
    openCard('Item A');

    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Copiar link' }),
    );
    expect(await screen.findByText('Link do card QD-1 copiado.')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('?card=QD-1'),
    );

    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Copiar link' }),
    );
    expect(
      await screen.findByText('O navegador não deixou copiar o link.'),
    ).toBeTruthy();
  });

  it('esconde o copiar link quando o navegador não oferece a área de transferência', () => {
    renderBoard();
    openCard('Item A');
    expect(
      within(panel()).queryByRole('button', { name: 'Copiar link' }),
    ).toBeNull();
  });
});

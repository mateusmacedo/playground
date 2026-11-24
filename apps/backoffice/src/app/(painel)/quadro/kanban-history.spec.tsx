import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { KanbanBoard } from './kanban-board';
import type { BoardLane } from './model/board';

// Hierarquia: Item A > Item B.
const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'a', title: 'Item A' },
      { id: 'b', title: 'Item B', parentId: 'a' },
    ],
  },
  { id: 'doing', title: 'Em andamento', cards: [{ id: 'c', title: 'Item C' }] },
];

function lane(name: string) {
  return screen.getByRole('region', { name });
}

function laneNames(): string[] {
  return Array.from(
    document.querySelectorAll('[data-lane-title]'),
    (heading) => heading.textContent ?? '',
  );
}

function cardTitles(laneName: string): string[] {
  return within(lane(laneName))
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '');
}

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

function button(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function announcement(): string {
  return document.querySelector('[aria-live="assertive"]')?.textContent ?? '';
}

function addLane(title: string) {
  fireEvent.click(button('Adicionar coluna'));
  const input = screen.getByRole('textbox', { name: 'Nome da nova coluna' });
  fireEvent.change(input, { target: { value: title } });
  fireEvent.submit(input);
}

function activity(): string[] {
  return within(within(panel()).getByRole('region', { name: 'Histórico' }))
    .queryAllByRole('listitem')
    .map((item) => item.querySelector('span')?.textContent ?? '');
}

describe('KanbanBoard: desfazer, arquivo e histórico', () => {
  it('desfaz e refaz pelos botões e pelos atalhos, com anúncio', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    expect(button('Desfazer').disabled).toBe(true);
    expect(button('Refazer').disabled).toBe(true);

    addLane('Revisão');
    fireEvent.click(button('Desfazer'));
    expect(laneNames()).toEqual(['A fazer', 'Em andamento']);
    expect(announcement()).toBe('Alteração desfeita.');

    fireEvent.click(button('Refazer'));
    expect(laneNames()).toContain('Revisão');
    expect(announcement()).toBe('Alteração refeita.');

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(laneNames()).not.toContain('Revisão');
    fireEvent.keyDown(document.body, {
      key: 'Z',
      metaKey: true,
      shiftKey: true,
    });
    expect(laneNames()).toContain('Revisão');
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true });
    expect(laneNames()).toContain('Revisão');

    fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true });
    expect(announcement()).toBe('Alteração refeita.');
  });

  it('deixa o Ctrl+Z dentro do campo de texto com o próprio campo', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item C');
    const title = within(panel()).getByLabelText('Título');
    fireEvent.change(title, { target: { value: 'Item C2' } });
    fireEvent.keyDown(title, { key: 'z', ctrlKey: true });

    expect(cardTitles('Em andamento')).toEqual(['Item C2']);
  });

  it('junta a digitação do título num passo só, e o desfazer atualiza o campo', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item C');
    const title = within(panel()).getByLabelText('Título') as HTMLInputElement;
    for (const value of ['Item C', 'Item C n', 'Item C no', 'Item C novo']) {
      fireEvent.change(title, { target: { value } });
    }

    fireEvent.click(button('Desfazer'));
    expect(cardTitles('Em andamento')).toEqual(['Item C']);
    expect(title.value).toBe('Item C');
    expect(button('Desfazer').disabled).toBe(true);
  });

  it('conta o movimento pelo teclado como um passo, e o Esc como nenhum', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    let handle = button('Mover Item A');
    fireEvent.click(handle);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    handle = button('Mover Item A');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    fireEvent.keyDown(handle, { key: 'Escape' });
    expect(cardTitles('A fazer')).toEqual(['Item A', 'Item B']);
    expect(button('Desfazer').disabled).toBe(true);

    handle = button('Mover Item A');
    fireEvent.click(handle);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    handle = button('Mover Item A');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    fireEvent.click(handle);
    expect(cardTitles('Em andamento')).toEqual(['Item C', 'Item A']);

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(cardTitles('A fazer')).toEqual(['Item A', 'Item B']);
    expect(button('Desfazer').disabled).toBe(true);
  });

  it('arquiva o card com os filhos e restaura pela lista de arquivados', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item A');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Arquivar card' }),
    );

    expect(cardTitles('A fazer')).toEqual([]);
    expect(announcement()).toBe('Card Item A arquivado.');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(lane('A fazer')).getByRole('heading', { level: 2 }),
      ),
    );

    fireEvent.click(button('Arquivados (1)'));
    const list = await screen.findByRole('dialog', {
      name: 'Cards arquivados',
    });
    expect(within(list).getByRole('listitem').textContent).toContain(
      'Item A e 1 card filho',
    );
    fireEvent.click(
      within(list).getByRole('button', { name: 'Restaurar Item A' }),
    );

    expect(cardTitles('A fazer')).toEqual(['Item A', 'Item B']);
    expect(
      within(cardItem('Item B')).getByText('Filho de Item A'),
    ).toBeTruthy();
    expect(announcement()).toBe('Card Item A restaurado.');
    expect(within(list).getByText('Nenhum card arquivado.')).toBeTruthy();

    fireEvent.click(within(list).getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(button('Arquivados (0)')),
    );
  });

  it('exclui de vez pela lista, e o desfazer traz o arquivamento de volta', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item C');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Arquivar card' }),
    );
    fireEvent.click(button('Arquivados (1)'));
    const list = await screen.findByRole('dialog', {
      name: 'Cards arquivados',
    });
    fireEvent.click(
      within(list).getByRole('button', { name: 'Excluir de vez Item C' }),
    );

    expect(announcement()).toBe('Card Item C excluído de vez.');
    expect(within(list).getByText('Nenhum card arquivado.')).toBeTruthy();
    fireEvent.click(within(list).getByRole('button', { name: 'Fechar' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Cards arquivados' }),
      ).toBeNull(),
    );

    fireEvent.click(button('Desfazer'));
    expect(button('Arquivados (1)')).toBeTruthy();
  });

  it('duplica o card logo abaixo e abre a cópia com o histórico de origem', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item A');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Duplicar card' }),
    );

    expect(cardTitles('A fazer')).toEqual([
      'Item A',
      'Item A (cópia)',
      'Item B',
    ]);
    expect(announcement()).toBe('Card Item A duplicado.');
    await waitFor(() =>
      expect(
        (within(panel()).getByLabelText('Título') as HTMLInputElement).value,
      ).toBe('Item A (cópia)'),
    );
    expect(activity()).toEqual(['Duplicado de QD-1.']);
    expect(within(cardItem('Item A (cópia)')).getByText('QD-4')).toBeTruthy();
  });

  it('mostra o histórico do card, do mais recente para o mais antigo', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item C');
    expect(within(panel()).getByText('Nenhum registro ainda.')).toBeTruthy();

    fireEvent.change(within(panel()).getByLabelText('Coluna'), {
      target: { value: 'todo' },
    });
    fireEvent.change(within(panel()).getByLabelText('Descrição'), {
      target: { value: 'Texto' },
    });

    expect(activity()).toEqual([
      'Descrição alterada.',
      'Movido de Em andamento para A fazer.',
    ]);
    expect(
      within(panel())
        .getAllByRole('listitem')
        .some((item) => item.querySelector('time')?.textContent),
    ).toBe(true);
  });
});

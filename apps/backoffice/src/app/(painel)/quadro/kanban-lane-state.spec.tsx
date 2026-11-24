import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { fireDrag } from './drag-test-utils';
import { KanbanBoard } from './kanban-board';
import type { BoardLane } from './model/board';

const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'a', title: 'Item A', description: 'Descrição do A' },
      { id: 'b', title: 'Item B', parentId: 'a' },
    ],
  },
  { id: 'doing', title: 'Em andamento', cards: [{ id: 'c', title: 'Item C' }] },
  { id: 'done', title: 'Concluído', cards: [] },
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

function laneMenu(laneName: string, item: string): HTMLButtonElement {
  fireEvent.click(button(`Ações da coluna ${laneName}`));
  return within(lane(laneName)).getByRole('button', {
    name: item,
  }) as HTMLButtonElement;
}

describe('KanbanBoard: colunas ocultas e bloqueadas', () => {
  it('oculta a coluna pelo menu e mostra de novo pela barra', async () => {
    render(<KanbanBoard initialLanes={lanes} />);

    fireEvent.click(laneMenu('Em andamento', 'Ocultar coluna'));

    expect(laneNames()).toEqual(['A fazer', 'Concluído']);
    expect(announcement()).toBe('Coluna Em andamento oculta.');
    fireEvent.click(button('Colunas ocultas (1)'));
    fireEvent.click(button('Mostrar Em andamento'));
    expect(laneNames()).toEqual(['A fazer', 'Em andamento', 'Concluído']);
    expect(
      screen.queryByRole('button', { name: /^Colunas ocultas/ }),
    ).toBeNull();

    fireEvent.click(laneMenu('A fazer', 'Ocultar coluna'));
    fireEvent.click(laneMenu('Concluído', 'Ocultar coluna'));
    expect(laneMenu('Em andamento', 'Ocultar coluna').disabled).toBe(true);
    fireEvent.click(button('Colunas ocultas (2)'));
    fireEvent.click(button('Mostrar todas'));
    await waitFor(() =>
      expect(laneNames()).toEqual(['A fazer', 'Em andamento', 'Concluído']),
    );
  });

  it('move pelo teclado só entre as colunas visíveis, sem tirar a oculta do lugar', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    fireEvent.click(laneMenu('Em andamento', 'Ocultar coluna'));

    let handle = button('Mover Item A');
    fireEvent.click(handle);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    handle = button('Mover Item A');
    fireEvent.click(handle);

    expect(cardTitles('Concluído')).toEqual(['Item A']);
    fireEvent.click(button('Colunas ocultas (1)'));
    fireEvent.click(button('Mostrar Em andamento'));
    expect(laneNames()).toEqual(['A fazer', 'Em andamento', 'Concluído']);
    expect(cardTitles('Em andamento')).toEqual(['Item C']);
  });

  it('ao bloquear a coluna, trava os cards dela e tira "Adicionar card"; liberar desfaz', () => {
    render(<KanbanBoard initialLanes={lanes} />);

    fireEvent.click(laneMenu('Em andamento', 'Bloquear coluna'));

    expect(announcement()).toBe('Coluna Em andamento bloqueada.');
    expect(
      within(lane('Em andamento')).getByText('Coluna bloqueada'),
    ).toBeTruthy();
    expect(button('Mover Item C').disabled).toBe(true);
    expect(cardItem('Item C').getAttribute('draggable')).toBe('false');
    expect(
      within(lane('Em andamento')).queryByRole('button', {
        name: 'Adicionar card',
      }),
    ).toBeNull();
    expect(laneMenu('Em andamento', 'Excluir coluna').disabled).toBe(true);

    fireEvent.click(laneMenu('Em andamento', 'Liberar coluna'));
    expect(announcement()).toBe('Coluna Em andamento liberada.');
    expect(button('Mover Item C').disabled).toBe(false);
  });

  it('a coluna bloqueada não recebe card pelo teclado nem pelo arraste', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    fireEvent.click(laneMenu('Em andamento', 'Bloquear coluna'));

    let handle = button('Mover Item A');
    fireEvent.click(handle);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    handle = button('Mover Item A');
    fireEvent.click(handle);
    expect(cardTitles('Em andamento')).toEqual(['Item C']);

    fireDrag({ kind: 'dragStart', element: cardItem('Item A') });
    expect(fireDrag({ kind: 'dragOver', element: lane('Em andamento') })).toBe(
      true,
    );
    fireDrag({ kind: 'dragEnd', element: cardItem('Item A') });
  });

  it('a coluna bloqueada não solta o card pelo painel: nem mover, nem arquivar', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    fireEvent.click(laneMenu('Em andamento', 'Bloquear coluna'));
    openCard('Item C');

    fireEvent.change(within(panel()).getByLabelText('Coluna'), {
      target: { value: 'done' },
    });
    expect(
      screen.getByText(
        'A coluna Em andamento está bloqueada: libere a coluna para mudar os cards dela.',
      ),
    ).toBeTruthy();
    expect(cardTitles('Em andamento')).toEqual(['Item C']);

    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Arquivar card' }),
    );
    expect(cardTitles('Em andamento')).toEqual(['Item C']);
  });
});

describe('KanbanBoard: coluna de arquivados', () => {
  it('mostra o arquivado na coluna e abre só para leitura, com restaurar', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    const archive = lane('Arquivados');
    expect(within(archive).getByText(/Nenhum card arquivado/)).toBeTruthy();

    openCard('Item A');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Arquivar card' }),
    );

    expect(within(archive).getByText('QD-1')).toBeTruthy();
    expect(within(archive).getByText('e 1 card filho')).toBeTruthy();
    fireEvent.click(
      within(archive).getByRole('button', { name: 'Ver Item A, arquivado' }),
    );
    const view = await screen.findByRole('dialog', {
      name: 'Card arquivado QD-1',
    });
    expect(within(view).getByText('Descrição do A')).toBeTruthy();
    expect(within(view).queryByRole('textbox')).toBeNull();

    fireEvent.click(within(view).getByRole('button', { name: 'QD-2 Item B' }));
    expect(
      await screen.findByRole('dialog', { name: 'Card arquivado QD-2' }),
    ).toBeTruthy();
    fireEvent.click(button('Restaurar com o grupo'));

    expect(cardTitles('A fazer')).toEqual(['Item A', 'Item B']);
    expect(announcement()).toBe('Card Item A restaurado.');
  });

  it('arquiva o card solto na coluna de arquivados', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    const archive = lane('Arquivados');

    fireDrag({ kind: 'dragStart', element: cardItem('Item C') });
    expect(fireDrag({ kind: 'dragOver', element: archive })).toBe(false);
    expect(archive.className).toContain('kanban-lane--drop-target');
    fireDrag({ kind: 'dragLeave', element: archive, relatedTarget: null });
    expect(archive.className).not.toContain('kanban-lane--drop-target');
    fireDrag({ kind: 'dragOver', element: archive });
    fireDrag({ kind: 'drop', element: archive });

    expect(cardTitles('Em andamento')).toEqual([]);
    expect(within(archive).getByText('Item C')).toBeTruthy();
    expect(announcement()).toBe('Card Item C arquivado.');
    expect(fireDrag({ kind: 'dragOver', element: archive })).toBe(true);
    fireDrag({ kind: 'drop', element: archive });
  });

  it('não restaura nem arquiva por arraste numa coluna bloqueada', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item C');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Arquivar card' }),
    );
    fireEvent.click(laneMenu('Em andamento', 'Bloquear coluna'));

    fireEvent.click(button('Arquivados (1)'));
    const list = await screen.findByRole('dialog', {
      name: 'Cards arquivados',
    });
    fireEvent.click(
      within(list).getByRole('button', { name: 'Restaurar Item C' }),
    );
    expect(
      screen.getByText(
        'A coluna Em andamento está bloqueada: libere a coluna para restaurar o card nela.',
      ),
    ).toBeTruthy();
    expect(cardTitles('Em andamento')).toEqual([]);

    fireEvent.click(within(list).getByRole('button', { name: 'Ver Item C' }));
    const view = await screen.findByRole('dialog', {
      name: 'Card arquivado QD-3',
    });
    fireEvent.click(
      within(view).getByRole('button', { name: 'Excluir de vez' }),
    );
    expect(within(lane('Arquivados')).queryByText('Item C')).toBeNull();
    expect(announcement()).toBe('Card Item C excluído de vez.');
  });

  it('oculta a coluna de arquivados e mostra de novo pela barra', () => {
    render(<KanbanBoard initialLanes={lanes} />);

    fireEvent.click(button('Ocultar a coluna Arquivados'));

    expect(screen.queryByRole('region', { name: 'Arquivados' })).toBeNull();
    expect(announcement()).toBe('Coluna Arquivados oculta.');
    fireEvent.click(button('Colunas ocultas (1)'));
    fireEvent.click(button('Mostrar Arquivados'));
    expect(lane('Arquivados')).toBeTruthy();
  });
});

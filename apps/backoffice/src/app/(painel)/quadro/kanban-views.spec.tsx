import { fireEvent, render, screen, within } from '@testing-library/react';

import { fireDrag } from './drag-test-utils';
import { KanbanBoard } from './kanban-board';
import type { BoardLane } from './model/board';
import { boardViewKey } from './use-board-view';

const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'p', title: 'Pai' },
      { id: 'a', title: 'Filho A', parentId: 'p', dueDate: '2026-03-01' },
      { id: 's', title: 'Solto' },
    ],
  },
  {
    id: 'doing',
    title: 'Em andamento',
    cards: [{ id: 'b', title: 'Filho B', parentId: 'p' }],
  },
  { id: 'done', title: 'Concluído', cards: [] },
];

function button(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function bodyRows(): string[][] {
  const table = screen.getByRole('table');
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .slice(0, 3)
        .map((cell) => cell.textContent ?? ''),
    );
}

function cardItem(title: string): HTMLElement {
  return screen
    .getByRole('heading', { level: 3, name: title })
    .closest('li') as HTMLElement;
}

describe('KanbanBoard: visão em lista', () => {
  afterEach(() => localStorage.clear());

  it('mostra um card por linha, ordena pelo cabeçalho e abre o card', () => {
    render(<KanbanBoard initialLanes={lanes} />);

    fireEvent.click(button('Lista'));

    expect(screen.queryByRole('region', { name: 'A fazer' })).toBeNull();
    expect(bodyRows()).toEqual([
      ['QD-1', 'Pai', 'A fazer'],
      ['QD-2', 'Filho A', 'A fazer'],
      ['QD-3', 'Solto', 'A fazer'],
      ['QD-4', 'Filho B', 'Em andamento'],
    ]);
    expect(button('Lista').getAttribute('aria-pressed')).toBe('true');
    expect(
      screen.getByRole('checkbox', { name: 'Linhas por card pai' }),
    ).toHaveProperty('disabled', true);

    fireEvent.click(button('Título'));
    expect(bodyRows().map((row) => row[1])).toEqual([
      'Filho A',
      'Filho B',
      'Pai',
      'Solto',
    ]);
    expect(
      screen
        .getByRole('columnheader', { name: /Título/ })
        .getAttribute('aria-sort'),
    ).toBe('ascending');
    fireEvent.click(button('Título'));
    expect(bodyRows()[0]?.[1]).toBe('Solto');

    fireEvent.click(
      within(screen.getByRole('table')).getByRole('button', {
        name: 'Filho B',
      }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Detalhes do card' }),
    ).toBeTruthy();
  });

  it('mostra só os cards da busca e grava a visão escolhida', () => {
    const { unmount } = render(
      <KanbanBoard initialLanes={lanes} storageKey="quadro:visao-teste" />,
    );
    fireEvent.click(button('Lista'));
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'filho' },
    });
    expect(bodyRows().map((row) => row[1])).toEqual(['Filho A', 'Filho B']);
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'nada disso' },
    });
    expect(screen.getByText('Nenhum card para mostrar.')).toBeTruthy();
    expect(localStorage.getItem(boardViewKey('quadro:visao-teste'))).toContain(
      'list',
    );

    unmount();
    render(
      <KanbanBoard initialLanes={lanes} storageKey="quadro:visao-teste" />,
    );
    expect(screen.getByRole('table')).toBeTruthy();
    fireEvent.click(button('Quadro'));
    expect(screen.getByRole('region', { name: 'A fazer' })).toBeTruthy();
  });
});

describe('KanbanBoard: linhas por card pai', () => {
  afterEach(() => localStorage.clear());

  it('agrupa os filhos na linha do pai e os sem pai no fim', () => {
    render(<KanbanBoard initialLanes={lanes} />);

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Linhas por card pai' }),
    );

    const parentRow = screen.getByRole('region', { name: 'QD-1 Pai' });
    expect(
      within(
        within(parentRow).getByRole('group', { name: 'A fazer em Pai' }),
      ).getByText('Filho A'),
    ).toBeTruthy();
    expect(
      within(
        within(parentRow).getByRole('group', { name: 'Em andamento em Pai' }),
      ).getByText('Filho B'),
    ).toBeTruthy();
    const orphans = screen.getByRole('region', { name: 'Sem card pai' });
    expect(within(orphans).getByText('Solto')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Arquivados' })).toBeNull();
  });

  it('leva o card solto na célula para o fim daquela coluna', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Linhas por card pai' }),
    );
    const parentRow = screen.getByRole('region', { name: 'QD-1 Pai' });
    const target = within(parentRow).getByRole('group', {
      name: 'Concluído em Pai',
    });

    fireDrag({ kind: 'dragStart', element: cardItem('Filho A') });
    expect(fireDrag({ kind: 'dragOver', element: target })).toBe(false);
    expect(target.className).toContain('kanban-lane--drop-target');
    fireDrag({ kind: 'dragLeave', element: target, relatedTarget: null });
    expect(target.className).not.toContain('kanban-lane--drop-target');
    fireDrag({ kind: 'dragOver', element: target });
    fireDrag({ kind: 'drop', element: target });

    expect(within(target).getByText('Filho A')).toBeTruthy();
    expect(document.querySelector('[aria-live="assertive"]')?.textContent).toBe(
      'Card Filho A movido para Concluído.',
    );
    expect(fireDrag({ kind: 'dragOver', element: target })).toBe(true);
    fireDrag({ kind: 'drop', element: target });
  });

  it('não solta na célula de coluna bloqueada nem na mesma coluna', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    fireEvent.click(button('Ações da coluna Concluído'));
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Concluído' })).getByRole(
        'button',
        { name: 'Bloquear coluna' },
      ),
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Linhas por card pai' }),
    );
    const parentRow = screen.getByRole('region', { name: 'QD-1 Pai' });

    fireDrag({ kind: 'dragStart', element: cardItem('Filho A') });
    expect(
      fireDrag({
        kind: 'dragOver',
        element: within(parentRow).getByRole('group', {
          name: 'Concluído em Pai',
        }),
      }),
    ).toBe(true);
    const same = within(parentRow).getByRole('group', {
      name: 'A fazer em Pai',
    });
    fireDrag({ kind: 'dragOver', element: same });
    fireDrag({ kind: 'drop', element: same });
    expect(within(same).getByText('Filho A')).toBeTruthy();
  });
});

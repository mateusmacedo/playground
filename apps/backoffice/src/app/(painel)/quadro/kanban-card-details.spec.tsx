import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { KanbanBoard } from './kanban-board';
import type { BoardLane } from './model/board';

// Hierarquia: Item A > Item B > Item C, e Item D solto.
const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'a', title: 'Item A', description: 'Descrição do A' },
      { id: 'b', title: 'Item B', parentId: 'a' },
    ],
  },
  {
    id: 'doing',
    title: 'Em andamento',
    cards: [{ id: 'c', title: 'Item C', parentId: 'b' }],
  },
  { id: 'done', title: 'Concluído', cards: [{ id: 'd', title: 'Item D' }] },
];

function lane(name: string) {
  return screen.getByRole('region', { name });
}

function cardTitles(laneName: string): string[] {
  return within(lane(laneName))
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '');
}

function cardItem(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 3, name: title });
  return heading.closest('li') as HTMLElement;
}

function openCard(title: string) {
  fireEvent.click(within(cardItem(title)).getByRole('button', { name: title }));
}

function panel() {
  return screen.getByRole('dialog', { name: 'Detalhes do card' });
}

function field(name: string) {
  return within(panel()).getByLabelText(name) as
    | HTMLInputElement
    | HTMLSelectElement;
}

function optionLabels(select: HTMLSelectElement): string[] {
  return Array.from(select.options, (option) => option.textContent ?? '');
}

describe('KanbanBoard: detalhes e hierarquia', () => {
  it('mostra o pai e a quantidade de filhos na face do card', () => {
    render(<KanbanBoard initialLanes={lanes} />);

    expect(
      within(cardItem('Item B')).getByText('Filho de Item A'),
    ).toBeTruthy();
    expect(within(cardItem('Item A')).getByText('1 filho')).toBeTruthy();
    expect(within(cardItem('Item D')).queryByText(/filho/)).toBeNull();
  });

  it('abre os detalhes com o clique, destaca o card e leva o foco ao painel', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item A');

    expect(panel().classList.contains('kanban-details')).toBe(true);
    expect(cardItem('Item A').classList.contains('kanban-card--open')).toBe(
      true,
    );
    expect(field('Título').value).toBe('Item A');
    expect(field('Descrição').value).toBe('Descrição do A');
    expect(field('Coluna').value).toBe('todo');
    await waitFor(() => expect(document.activeElement).toBe(panel()));
  });

  it('fecha pelo botão ou pelo Esc e devolve o foco ao card', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item D');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Fechar os detalhes' }),
    );

    expect(cardItem('Item D').classList.contains('kanban-card--open')).toBe(
      false,
    );
    expect(document.activeElement).toBe(
      within(cardItem('Item D')).getByRole('button', { name: 'Item D' }),
    );

    openCard('Item C');
    await waitFor(() => expect(document.activeElement).toBe(panel()));
    fireEvent.keyDown(panel(), { key: 'Escape' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(cardItem('Item C')).getByRole('button', { name: 'Item C' }),
      ),
    );
  });

  it('edita título e descrição, e o título vazio não chega ao quadro', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item D');

    fireEvent.change(field('Título'), { target: { value: 'Item D2 ' } });
    expect(cardTitles('Concluído')).toEqual(['Item D2']);

    fireEvent.change(field('Título'), { target: { value: '' } });
    expect(
      within(panel()).getByText('O título não pode ficar vazio.'),
    ).toBeTruthy();
    expect(cardTitles('Concluído')).toEqual(['Item D2']);
    fireEvent.blur(field('Título'));
    expect(field('Título').value).toBe('Item D2');

    fireEvent.change(field('Descrição'), { target: { value: 'Linha 1 ' } });
    expect(within(cardItem('Item D2')).getByText('Linha 1')).toBeTruthy();
  });

  it('troca a coluna do card pelo painel', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item A');
    fireEvent.change(field('Coluna'), { target: { value: 'done' } });

    expect(cardTitles('Concluído')).toEqual(['Item D', 'Item A']);
    expect(field('Coluna').value).toBe('done');
  });

  it('oferece como pai só os cards que não fecham ciclo e troca o pai', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item A');
    expect(optionLabels(field('Card pai') as HTMLSelectElement)).toEqual([
      'Nenhum',
      'Item D (Concluído)',
    ]);

    openCard('Item D');
    fireEvent.change(field('Card pai'), { target: { value: 'c' } });
    expect(
      within(cardItem('Item D')).getByText('Filho de Item C'),
    ).toBeTruthy();

    fireEvent.change(field('Card pai'), { target: { value: '' } });
    expect(within(cardItem('Item D')).queryByText(/Filho de/)).toBeNull();
  });

  it('navega pelo caminho até a raiz e pelos filhos, com o foco no painel', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item C');

    const path = within(panel()).getByRole('navigation', {
      name: 'Caminho do card na hierarquia',
    });
    expect(path.textContent).toBe('Item AItem BItem C');
    expect(within(panel()).getByText('Nenhum card filho.')).toBeTruthy();

    fireEvent.click(within(path).getByRole('button', { name: 'Item A' }));
    expect(field('Título').value).toBe('Item A');
    await waitFor(() => expect(document.activeElement).toBe(panel()));

    const children = within(panel()).getByRole('region', {
      name: 'Cards filhos',
    });
    expect(within(children).getByRole('listitem').textContent).toBe(
      'Item B (A fazer)',
    );
    fireEvent.click(within(children).getByRole('button', { name: 'Item B' }));
    expect(field('Título').value).toBe('Item B');
  });

  it('cria cards filhos na coluna do pai, e o Esc fecha só o campo', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item C');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Criar card filho' }),
    );
    const input = within(panel()).getByRole('textbox', {
      name: 'Título do novo card filho, na coluna Em andamento',
    });
    fireEvent.change(input, { target: { value: 'Sub 1' } });
    fireEvent.submit(input);
    fireEvent.change(input, { target: { value: 'Sub 2' } });
    fireEvent.submit(input);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(cardTitles('Em andamento')).toEqual(['Item C', 'Sub 1', 'Sub 2']);
    expect(within(cardItem('Sub 2')).getByText('Filho de Item C')).toBeTruthy();
    expect(within(cardItem('Item C')).getByText('2 filhos')).toBeTruthy();
    expect(field('Título').value).toBe('Item C');
    expect(document.activeElement).toBe(
      within(panel()).getByRole('button', { name: 'Criar card filho' }),
    );
  });

  it('exclui o card com confirmação e sobe os filhos para o pai dele', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Item B');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Excluir card' }),
    );

    expect(
      await screen.findByText(
        'O card sai do quadro. O card filho dele passa para Item A.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(cardTitles('A fazer')).toEqual(['Item A']);
    expect(
      within(cardItem('Item C')).getByText('Filho de Item A'),
    ).toBeTruthy();
    expect(document.querySelector('[aria-live="assertive"]')?.textContent).toBe(
      'Card Item B excluído.',
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(lane('A fazer')).getByRole('heading', { level: 2 }),
      ),
    );
  });

  it('descreve a exclusão de card sem filhos e de raiz com vários filhos', async () => {
    const withTwoChildren: readonly BoardLane[] = [
      {
        id: 'todo',
        title: 'A fazer',
        cards: [
          { id: 'a', title: 'Item A' },
          { id: 'b', title: 'Item B', parentId: 'a' },
          { id: 'c', title: 'Item C', parentId: 'a' },
        ],
      },
    ];
    render(<KanbanBoard initialLanes={withTwoChildren} />);

    openCard('Item B');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Excluir card' }),
    );
    expect(await screen.findByText('O card sai do quadro.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(screen.queryByText('O card sai do quadro.')).toBeNull(),
    );

    openCard('Item A');
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Excluir card' }),
    );
    expect(
      await screen.findByText(
        'O card sai do quadro. Os 2 cards filhos dele passam a ficar sem card pai.',
      ),
    ).toBeTruthy();
  });
});

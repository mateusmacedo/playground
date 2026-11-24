import {
  act,
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
      { id: 'b', title: 'Item B' },
    ],
  },
  { id: 'doing', title: 'Em andamento', cards: [{ id: 'c', title: 'Item C' }] },
  { id: 'done', title: 'Concluído', cards: [] },
];

function lane(name: string) {
  return screen.getByRole('region', { name });
}

/** Títulos dos cards de uma coluna, na ordem da tela. */
function cardTitles(laneName: string): string[] {
  return within(lane(laneName))
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '');
}

function cardItem(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 3, name: title });
  return heading.closest('li') as HTMLElement;
}

/** Contador ao lado do título da coluna, com a palavra que só o leitor de tela lê. */
function laneCount(laneName: string): string | null {
  const heading = within(lane(laneName)).getByRole('heading', { level: 2 });
  return heading.nextElementSibling?.textContent ?? null;
}

function laneBody(laneName: string): HTMLElement {
  return within(lane(laneName)).getByRole('list').parentElement as HTMLElement;
}

function handle(title: string) {
  return screen.getByRole('button', { name: `Mover ${title}` });
}

describe('KanbanBoard', () => {
  beforeEach(() => {
    render(<KanbanBoard initialLanes={lanes} />);
  });

  it('mostra cada coluna com título, contador e os cards na ordem', () => {
    // NOTE: as 3 colunas do quadro e a coluna automática dos arquivados.
    expect(screen.getAllByRole('region')).toHaveLength(4);
    expect(screen.getByRole('region', { name: 'Arquivados' })).toBeTruthy();
    expect(cardTitles('A fazer')).toEqual(['Item A', 'Item B']);
    expect(laneCount('A fazer')).toBe('2 cards');
    expect(laneCount('Em andamento')).toBe('1 card');
    expect(screen.getByText('Descrição do A')).toBeTruthy();
  });

  it('mostra a coluna vazia com o aviso e o contador zerado', () => {
    const empty = within(lane('Concluído'));

    expect(empty.getByText('Nenhum card nesta coluna.')).toBeTruthy();
    expect(laneCount('Concluído')).toBe('0 cards');
    expect(empty.queryByRole('list')).toBeNull();
  });

  it('leva o card para o fim de outra coluna ao arrastar e soltar', () => {
    fireDrag({ kind: 'dragStart', element: cardItem('Item A') });
    const target = within(lane('Em andamento')).getByRole('list');
    fireDrag({ kind: 'dragOver', element: target });
    fireDrag({ kind: 'drop', element: target });

    expect(cardTitles('A fazer')).toEqual(['Item B']);
    expect(cardTitles('Em andamento')).toEqual(['Item C', 'Item A']);
    expect(
      screen.getByText('Item A solto: coluna Em andamento, posição 2 de 2.'),
    ).toBeTruthy();
  });

  it('aceita o drop na coluna vazia', () => {
    fireDrag({ kind: 'dragStart', element: cardItem('Item C') });
    fireDrag({
      kind: 'drop',
      element: screen.getByText('Nenhum card nesta coluna.'),
    });

    expect(cardTitles('Concluído')).toEqual(['Item C']);
    expect(laneCount('Em andamento')).toBe('0 cards');
  });

  it('reordena na mesma coluna pela metade do card sob o ponteiro', () => {
    fireDrag({ kind: 'dragStart', element: cardItem('Item B') });
    fireDrag({ kind: 'dragOver', element: cardItem('Item A'), clientY: -1 });

    expect(cardItem('Item A').className).toContain('kanban-card--drop-before');

    fireDrag({ kind: 'drop', element: cardItem('Item A'), clientY: -1 });

    expect(cardTitles('A fazer')).toEqual(['Item B', 'Item A']);
  });

  it('desenha a linha de inserção só onde o drop muda o quadro', () => {
    fireDrag({ kind: 'dragStart', element: cardItem('Item A') });

    expect(cardItem('Item A').className).toContain('kanban-card--dragging');

    fireDrag({ kind: 'dragOver', element: cardItem('Item A'), clientY: 1 });
    fireDrag({ kind: 'dragOver', element: cardItem('Item A'), clientY: 1 });

    expect(document.querySelector('.kanban-card--drop-before')).toBeNull();
    expect(laneBody('A fazer').className).not.toContain('--drop-end');

    fireDrag({ kind: 'dragOver', element: cardItem('Item B'), clientY: 1 });

    expect(laneBody('A fazer').className).toContain(
      'kanban-lane__body--drop-end',
    );
  });

  it('apaga a linha ao sair da coluna e encerra o arraste no dragend', () => {
    fireDrag({ kind: 'dragStart', element: cardItem('Item A') });
    fireDrag({ kind: 'dragOver', element: cardItem('Item B'), clientY: 1 });
    fireDrag({
      kind: 'dragLeave',
      element: laneBody('A fazer'),
      relatedTarget: cardItem('Item B'),
    });

    expect(laneBody('A fazer').className).toContain('--drop-end');

    fireDrag({
      kind: 'dragLeave',
      element: laneBody('Em andamento'),
      relatedTarget: document.body,
    });

    expect(laneBody('A fazer').className).toContain('--drop-end');

    fireDrag({
      kind: 'dragLeave',
      element: laneBody('A fazer'),
      relatedTarget: document.body,
    });

    expect(laneBody('A fazer').className).not.toContain('--drop-end');

    fireDrag({ kind: 'dragEnd', element: cardItem('Item A') });

    expect(cardItem('Item A').className).not.toContain('--dragging');
  });

  it('não muda o quadro quando o card é solto no mesmo lugar', () => {
    fireDrag({ kind: 'dragStart', element: cardItem('Item A') });
    fireDrag({ kind: 'drop', element: cardItem('Item A'), clientY: -1 });

    expect(cardTitles('A fazer')).toEqual(['Item A', 'Item B']);
    expect(cardItem('Item A').className).not.toContain('--dragging');
  });

  it('recusa arraste que não começou num card, como o de um arquivo', () => {
    const target = within(lane('Em andamento')).getByRole('list');

    expect(fireDrag({ kind: 'dragOver', element: target })).toBe(true);
    expect(fireDrag({ kind: 'drop', element: target })).toBe(true);
    expect(cardTitles('Em andamento')).toEqual(['Item C']);
  });

  it('pega, move com as setas e solta o card pelo teclado', () => {
    act(() => handle('Item A').focus());
    fireEvent.click(handle('Item A'));

    expect(handle('Item A').getAttribute('aria-pressed')).toBe('true');
    expect(
      screen.getByText('Item A pego: coluna A fazer, posição 1 de 2.'),
    ).toBeTruthy();

    fireEvent.keyDown(handle('Item A'), { key: 'ArrowDown' });

    expect(cardTitles('A fazer')).toEqual(['Item B', 'Item A']);
    expect(
      screen.getByText('Item A: coluna A fazer, posição 2 de 2.'),
    ).toBeTruthy();

    fireEvent.keyDown(handle('Item A'), { key: 'ArrowRight' });

    expect(cardTitles('Em andamento')).toEqual(['Item C', 'Item A']);
    expect(document.activeElement).toBe(handle('Item A'));

    fireEvent.click(handle('Item A'));

    expect(handle('Item A').getAttribute('aria-pressed')).toBe('false');
    expect(
      screen.getByText('Item A solto: coluna Em andamento, posição 2 de 2.'),
    ).toBeTruthy();
  });

  it('desfaz o movimento com Esc e devolve o foco à alça', () => {
    act(() => handle('Item A').focus());
    fireEvent.click(handle('Item A'));
    fireEvent.keyDown(handle('Item A'), { key: 'ArrowRight' });
    fireEvent.keyDown(handle('Item A'), { key: 'Escape' });

    expect(cardTitles('A fazer')).toEqual(['Item A', 'Item B']);
    expect(cardTitles('Em andamento')).toEqual(['Item C']);
    expect(document.activeElement).toBe(handle('Item A'));
    expect(handle('Item A').getAttribute('aria-pressed')).toBe('false');
    expect(
      screen.getByText(
        'Movimento cancelado. Item A voltou para coluna A fazer, posição 1 de 2.',
      ),
    ).toBeTruthy();
  });

  it('ignora teclado e foco sem card pego e passos além da ponta da coluna', () => {
    fireEvent.keyDown(handle('Item A'), { key: 'ArrowDown' });
    fireEvent.keyDown(handle('Item A'), { key: 'Escape' });
    fireEvent.blur(handle('Item A'));

    expect(cardTitles('A fazer')).toEqual(['Item A', 'Item B']);

    fireEvent.click(handle('Item A'));
    fireEvent.keyDown(handle('Item A'), { key: 'ArrowUp' });
    fireEvent.keyDown(handle('Item A'), { key: 'ArrowLeft' });
    fireEvent.keyDown(handle('Item A'), { key: 'a' });

    expect(cardTitles('A fazer')).toEqual(['Item A', 'Item B']);
    expect(
      screen.getByText('Item A pego: coluna A fazer, posição 1 de 2.'),
    ).toBeTruthy();
  });

  it('troca o card pego quando outra alça é acionada', () => {
    fireEvent.click(handle('Item A'));
    fireEvent.click(handle('Item C'));

    expect(handle('Item A').getAttribute('aria-pressed')).toBe('false');
    expect(handle('Item C').getAttribute('aria-pressed')).toBe('true');
  });

  it('mantém o card pego enquanto o foco continua na alça dele', async () => {
    act(() => handle('Item A').focus());
    fireEvent.click(handle('Item A'));
    fireEvent.blur(handle('Item A'));
    await act(async () => undefined);

    expect(handle('Item A').getAttribute('aria-pressed')).toBe('true');
  });

  it('solta o card quando o foco sai da alça', async () => {
    act(() => handle('Item A').focus());
    fireEvent.click(handle('Item A'));
    act(() => handle('Item B').focus());

    await waitFor(() =>
      expect(handle('Item A').getAttribute('aria-pressed')).toBe('false'),
    );
  });

  it('solta o card pego pelo teclado quando um arraste começa', () => {
    fireEvent.click(handle('Item A'));
    fireDrag({ kind: 'dragStart', element: cardItem('Item B') });

    expect(handle('Item A').getAttribute('aria-pressed')).toBe('false');
  });
});

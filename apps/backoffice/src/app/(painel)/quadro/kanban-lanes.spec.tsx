import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { fakeDataTransfer, fireDrag } from './drag-test-utils';
import { KanbanBoard } from './kanban-board';
import type { BoardLane } from './model/board';

const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'a', title: 'Item A' },
      { id: 'b', title: 'Item B' },
    ],
  },
  { id: 'doing', title: 'Em andamento', cards: [{ id: 'c', title: 'Item C' }] },
  { id: 'done', title: 'Concluído', cards: [] },
];

function lane(name: string) {
  return screen.getByRole('region', { name });
}

/** Nomes das colunas na ordem da tela; o painel de detalhes também tem um título de nível 2. */
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

function announcement(): string {
  return document.querySelector('[aria-live="assertive"]')?.textContent ?? '';
}

function openLaneMenu(laneName: string, item: string) {
  fireEvent.click(
    screen.getByRole('button', { name: `Ações da coluna ${laneName}` }),
  );
  fireEvent.click(within(lane(laneName)).getByRole('button', { name: item }));
}

/** Cada coluna ocupa 100px de largura, uma ao lado da outra. */
function layOutLanes() {
  for (const section of document.querySelectorAll<HTMLElement>(
    '[data-lane-index]',
  )) {
    const left = Number(section.dataset.laneIndex) * 100;
    section.getBoundingClientRect = () =>
      ({ left, width: 100, top: 0, height: 300 }) as DOMRect;
  }
}

describe('KanbanBoard: colunas', () => {
  it('renomeia a coluna pelo menu e devolve o foco ao título', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openLaneMenu('Em andamento', 'Renomear');

    const input = screen.getByRole('textbox', { name: 'Nome da coluna' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: '  Fazendo  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(laneNames()).toEqual(['A fazer', 'Fazendo', 'Concluído']);
    expect(document.activeElement).toBe(
      within(lane('Fazendo')).getByRole('heading', { level: 2 }),
    );
  });

  it('cancela com Esc, salva ao sair do campo e ignora nome vazio', () => {
    render(<KanbanBoard initialLanes={lanes} />);

    openLaneMenu('A fazer', 'Renomear');
    let input = screen.getByRole('textbox', { name: 'Nome da coluna' });
    fireEvent.change(input, { target: { value: 'Descartado' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(laneNames()[0]).toBe('A fazer');

    openLaneMenu('A fazer', 'Renomear');
    input = screen.getByRole('textbox', { name: 'Nome da coluna' });
    fireEvent.change(input, { target: { value: 'Backlog' } });
    fireEvent.keyDown(input, { key: 'a' });
    fireEvent.blur(input);
    expect(laneNames()[0]).toBe('Backlog');

    openLaneMenu('Backlog', 'Renomear');
    input = screen.getByRole('textbox', { name: 'Nome da coluna' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(laneNames()[0]).toBe('Backlog');
  });

  it('cria a coluna no fim do quadro e anuncia', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar coluna' }));
    const input = screen.getByRole('textbox', { name: 'Nome da nova coluna' });
    fireEvent.change(input, { target: { value: 'Revisão' } });
    fireEvent.submit(input);

    expect(laneNames()).toEqual([
      'A fazer',
      'Em andamento',
      'Concluído',
      'Revisão',
    ]);
    expect(announcement()).toBe('Coluna Revisão criada.');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Adicionar coluna' }),
    );
  });

  it('cria cards no pé da coluna, um atrás do outro', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    fireEvent.click(
      within(lane('Concluído')).getByRole('button', {
        name: 'Adicionar card',
      }),
    );
    const input = screen.getByRole('textbox', {
      name: 'Título do novo card em Concluído',
    });
    fireEvent.change(input, { target: { value: 'Novo 1' } });
    fireEvent.submit(input);
    fireEvent.change(input, { target: { value: 'Novo 2' } });
    fireEvent.submit(input);

    expect(cardTitles('Concluído')).toEqual(['Novo 1', 'Novo 2']);
    expect(announcement()).toBe('Card Novo 2 criado em Concluído.');
    expect(document.activeElement).toBe(input);
  });

  it('move a coluna pelo teclado e desfaz com Esc', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    const handle = screen.getByRole('button', {
      name: 'Mover a coluna Concluído',
    });

    fireEvent.click(handle);
    expect(handle.getAttribute('aria-pressed')).toBe('true');
    expect(announcement()).toBe('Coluna Concluído pega: posição 3 de 3.');

    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(laneNames()).toEqual(['A fazer', 'Concluído', 'Em andamento']);
    expect(document.activeElement).toBe(handle);
    expect(announcement()).toBe('Coluna Concluído: posição 2 de 3.');

    fireEvent.keyDown(handle, { key: 'Escape' });
    expect(laneNames()).toEqual(['A fazer', 'Em andamento', 'Concluído']);
    expect(announcement()).toBe(
      'Movimento cancelado. Coluna Concluído voltou para a posição 3 de 3.',
    );

    fireEvent.click(handle);
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.click(handle);
    expect(announcement()).toBe('Coluna Concluído solta: posição 2 de 3.');
    expect(handle.getAttribute('aria-pressed')).toBe('false');
  });

  it('arrasta a coluna pela alça e mostra a linha só onde o drop muda o quadro', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    layOutLanes();
    const handle = screen.getByRole('button', {
      name: 'Mover a coluna A fazer',
    });
    const board = lane('A fazer').parentElement as HTMLElement;

    const transfer = fakeDataTransfer();
    fireDrag({ kind: 'dragStart', element: handle, dataTransfer: transfer });
    expect(transfer.setDragImage).toHaveBeenCalledWith(lane('A fazer'), 24, 24);
    expect(lane('A fazer').classList.contains('kanban-lane--dragging')).toBe(
      true,
    );

    fireDrag({ kind: 'dragOver', element: lane('A fazer'), clientX: 10 });
    expect(document.querySelector('.kanban-lane--drop-before')).toBeNull();

    fireDrag({ kind: 'dragOver', element: lane('Concluído'), clientX: 280 });
    expect(
      lane('Concluído').classList.contains('kanban-lane--drop-after'),
    ).toBe(true);

    fireDrag({
      kind: 'dragLeave',
      element: board,
      relatedTarget: lane('Concluído'),
    });
    expect(
      lane('Concluído').classList.contains('kanban-lane--drop-after'),
    ).toBe(true);
    fireDrag({
      kind: 'dragLeave',
      element: board,
      relatedTarget: document.body,
    });
    expect(
      lane('Concluído').classList.contains('kanban-lane--drop-after'),
    ).toBe(false);

    fireDrag({ kind: 'dragOver', element: lane('Concluído'), clientX: 220 });
    expect(
      lane('Concluído').classList.contains('kanban-lane--drop-before'),
    ).toBe(true);
    fireDrag({ kind: 'drop', element: lane('Concluído'), clientX: 220 });

    expect(laneNames()).toEqual(['Em andamento', 'A fazer', 'Concluído']);
    expect(announcement()).toBe('Coluna A fazer solta: posição 2 de 3.');
    expect(lane('A fazer').classList.contains('kanban-lane--dragging')).toBe(
      false,
    );
  });

  it('ignora drop no mesmo lugar e arraste que não é de coluna', () => {
    render(<KanbanBoard initialLanes={lanes} />);
    layOutLanes();
    const board = lane('A fazer').parentElement as HTMLElement;

    fireDrag({ kind: 'dragOver', element: board, clientX: 150 });
    fireDrag({ kind: 'drop', element: board, clientX: 150 });
    expect(laneNames()).toEqual(['A fazer', 'Em andamento', 'Concluído']);

    fireDrag({
      kind: 'dragStart',
      element: screen.getByRole('button', {
        name: 'Mover a coluna Em andamento',
      }),
    });
    fireDrag({ kind: 'drop', element: board, clientX: 150 });
    expect(laneNames()).toEqual(['A fazer', 'Em andamento', 'Concluído']);

    fireDrag({
      kind: 'dragStart',
      element: screen.getByRole('button', {
        name: 'Mover a coluna Em andamento',
      }),
    });
    fireDrag({
      kind: 'dragEnd',
      element: screen.getByRole('button', {
        name: 'Mover a coluna Em andamento',
      }),
    });
    expect(
      lane('Em andamento').classList.contains('kanban-lane--dragging'),
    ).toBe(false);
  });

  it('define o limite, destaca a coluna acima dele e tira o limite', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openLaneMenu('A fazer', 'Limite de cards');

    const field = await screen.findByRole('spinbutton', {
      name: 'Máximo de cards',
    });
    fireEvent.change(field, { target: { value: '0' } });
    expect(
      (screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.change(field, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(lane('A fazer').classList.contains('kanban-lane--over-limit')).toBe(
      true,
    );
    expect(within(lane('A fazer')).getByText(/acima do limite/)).toBeTruthy();
    expect(lane('A fazer').querySelector('.badge')?.textContent).toBe(
      '2 de 1 cards, acima do limite',
    );

    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(lane('A fazer')).getByRole('heading', { level: 2 }),
      ),
    );

    openLaneMenu('A fazer', 'Limite de cards');
    const again = await screen.findByRole('spinbutton', {
      name: 'Máximo de cards',
    });
    expect((again as HTMLInputElement).value).toBe('1');
    fireEvent.change(again, { target: { value: '' } });
    fireEvent.submit(again);
    expect(lane('A fazer').classList.contains('kanban-lane--over-limit')).toBe(
      false,
    );
  });

  it('cancela o limite sem mudar a coluna', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openLaneMenu('Em andamento', 'Limite de cards');
    fireEvent.change(
      await screen.findByRole('spinbutton', { name: 'Máximo de cards' }),
      { target: { value: '3' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(lane('Em andamento').querySelector('.badge')?.textContent).toBe(
      '1 card',
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(lane('Em andamento')).getByRole('heading', { level: 2 }),
      ),
    );
  });

  it('exclui a coluna vazia e leva o foco à coluna vizinha', async () => {
    render(<KanbanBoard initialLanes={lanes} />);

    openLaneMenu('Concluído', 'Excluir coluna');
    expect(
      await screen.findByText('A coluna está vazia e sai do quadro.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(laneNames()).toEqual(['A fazer', 'Em andamento']);
    expect(announcement()).toBe('Coluna Concluído excluída.');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(lane('Em andamento')).getByRole('heading', { level: 2 }),
      ),
    );
  });

  it('exclui a coluna com cards levando-os ao destino, e não exclui a última', async () => {
    render(
      <KanbanBoard initialLanes={lanes.filter((item) => item.id !== 'done')} />,
    );

    openLaneMenu('A fazer', 'Excluir coluna');
    expect(
      await screen.findByText(
        'Os 2 cards desta coluna vão para o fim da coluna escolhida.',
      ),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('combobox', {
          name: 'Mover os cards para',
        }) as HTMLInputElement
      ).value,
    ).toBe('doing');
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(laneNames()).toEqual(['Em andamento']);
    expect(cardTitles('Em andamento')).toEqual(['Item C', 'Item A', 'Item B']);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull(),
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Ações da coluna Em andamento' }),
    );
    expect(
      (
        within(lane('Em andamento')).getByRole('button', {
          name: 'Excluir coluna',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('escolhe outro destino para os cards da coluna excluída', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openLaneMenu('Em andamento', 'Excluir coluna');
    expect(
      await screen.findByText(
        'O card desta coluna vai para o fim da coluna escolhida.',
      ),
    ).toBeTruthy();
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Mover os cards para' }),
      { target: { value: 'done' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(cardTitles('Concluído')).toEqual(['Item C']);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(lane('Concluído')).getByRole('heading', { level: 2 }),
      ),
    );
  });
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { KanbanBoard } from './kanban-board';
import type { Board, BoardLane } from './model/board';
import { createBoard } from './model/board-state';
import { sampleLanes } from './model/sample-board';
import { BOARD_STORAGE_KEY, serializeBoard } from './model/storage';

const saved: Board = createBoard({
  lanes: [
    {
      id: 'lane-1',
      title: 'Gravada',
      cards: [{ id: 'card-1', title: 'Card gravado' }],
    },
  ],
});

function storedLaneTitles(): string[] {
  const raw = localStorage.getItem(BOARD_STORAGE_KEY);
  const data = raw
    ? (JSON.parse(raw) as { board: { lanes: BoardLane[] } })
    : null;
  return data?.board.lanes.map((lane) => lane.title) ?? [];
}

function addLane(title: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar coluna' }));
  const input = screen.getByRole('textbox', { name: 'Nome da nova coluna' });
  fireEvent.change(input, { target: { value: title } });
  fireEvent.submit(input);
}

describe('KanbanBoard: quadro gravado no navegador', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('troca o quadro inicial pelo gravado depois de montar', async () => {
    localStorage.setItem(BOARD_STORAGE_KEY, serializeBoard(saved));
    render(
      <KanbanBoard initialLanes={sampleLanes} storageKey={BOARD_STORAGE_KEY} />,
    );

    expect(await screen.findByRole('region', { name: 'Gravada' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'A fazer' })).toBeNull();
  });

  it('ignora o gravado inválido e grava cada mudança', async () => {
    localStorage.setItem(BOARD_STORAGE_KEY, '{quebrado');
    render(
      <KanbanBoard initialLanes={sampleLanes} storageKey={BOARD_STORAGE_KEY} />,
    );

    await waitFor(() =>
      expect(storedLaneTitles()).toEqual([
        'A fazer',
        'Em andamento',
        'Concluído',
      ]),
    );
    addLane('Revisão');
    await waitFor(() => expect(storedLaneTitles()).toContain('Revisão'));
  });

  it('sem chave, não lê nem grava nada', async () => {
    localStorage.setItem(BOARD_STORAGE_KEY, serializeBoard(saved));
    render(<KanbanBoard initialLanes={sampleLanes} />);
    addLane('Revisão');
    await act(async () => undefined);

    expect(screen.getByRole('region', { name: 'A fazer' })).toBeTruthy();
    expect(storedLaneTitles()).toEqual(['Gravada']);
  });

  it('segue só na memória quando o navegador recusa o armazenamento', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('armazenamento bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cota cheia');
    });
    render(
      <KanbanBoard initialLanes={sampleLanes} storageKey={BOARD_STORAGE_KEY} />,
    );
    addLane('Revisão');
    await act(async () => undefined);

    expect(screen.getByRole('region', { name: 'Revisão' })).toBeTruthy();
  });

  it('restaura o quadro de exemplo com confirmação', async () => {
    localStorage.setItem(BOARD_STORAGE_KEY, serializeBoard(saved));
    render(
      <KanbanBoard initialLanes={sampleLanes} storageKey={BOARD_STORAGE_KEY} />,
    );
    await screen.findByRole('region', { name: 'Gravada' });

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar exemplo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restaurar' }));

    expect(screen.getByRole('region', { name: 'A fazer' })).toBeTruthy();
    expect(document.querySelector('[aria-live="assertive"]')?.textContent).toBe(
      'Quadro de exemplo restaurado.',
    );
    await waitFor(() => expect(storedLaneTitles()).toHaveLength(3));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Restaurar exemplo' }),
      ),
    );
  });
});

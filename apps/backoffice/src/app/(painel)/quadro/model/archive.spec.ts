import { archiveCard, deleteArchived, restoreArchived } from './archive';
import type { Board } from './board';
import { createBoard } from './board-state';
import { duplicateCard } from './cards';

// Hierarquia: p > a > b; a e b em colunas diferentes.
const board: Board = createBoard({
  lanes: [
    {
      id: 'todo',
      title: 'A fazer',
      cards: [
        { id: 'p', title: 'Pai' },
        { id: 'a', title: 'A', parentId: 'p', labelIds: ['l1'] },
      ],
    },
    {
      id: 'doing',
      title: 'Em andamento',
      cards: [{ id: 'b', title: 'B', parentId: 'a' }],
    },
  ],
  labels: [{ id: 'l1', name: 'Urgente', color: 'danger' }],
});

const titles = (state: Board) =>
  state.lanes.map((lane) => lane.cards.map((card) => card.title));

describe('arquivo', () => {
  it('arquiva o card com os descendentes e restaura nas colunas de origem', () => {
    const archived = archiveCard({
      board,
      cardId: 'a',
      at: '2026-11-24T10:00:00Z',
    });
    expect(titles(archived)).toEqual([['Pai'], []]);
    expect(archived.archive[0]).toMatchObject({
      id: 'a',
      archivedAt: '2026-11-24T10:00:00Z',
    });
    expect(
      archived.archive[0]?.cards.map((item) => [item.card.id, item.laneId]),
    ).toEqual([
      ['a', 'todo'],
      ['b', 'doing'],
    ]);

    const restored = restoreArchived({ board: archived, entryId: 'a' });
    expect(titles(restored)).toEqual([['Pai', 'A'], ['B']]);
    expect(restored.archive).toEqual([]);
    expect(restored.lanes[0]?.cards[1]?.parentId).toBe('p');
  });

  it('restaura na primeira coluna, solta o pai e as etiquetas que sumiram', () => {
    let state = archiveCard({ board, cardId: 'a', at: 'agora' });
    state = {
      ...state,
      lanes: state.lanes
        .filter((lane) => lane.id !== 'doing')
        .map((lane) => ({ ...lane, cards: [] })),
      labels: [],
    };
    const restored = restoreArchived({ board: state, entryId: 'a' });
    expect(titles(restored)).toEqual([['A', 'B']]);
    expect(restored.lanes[0]?.cards[0]?.parentId).toBeUndefined();
    expect(restored.lanes[0]?.cards[0]?.labelIds).toBeUndefined();
    expect(restored.lanes[0]?.cards[1]?.parentId).toBe('a');
  });

  it('exclui de vez e ignora ids que não existem', () => {
    const archived = archiveCard({ board, cardId: 'b', at: 'agora' });
    expect(deleteArchived({ board: archived, entryId: 'b' }).archive).toEqual(
      [],
    );
    expect(deleteArchived({ board: archived, entryId: 'x' })).toBe(archived);
    expect(restoreArchived({ board: archived, entryId: 'x' })).toBe(archived);
    expect(archiveCard({ board, cardId: 'x', at: 'agora' })).toBe(board);
  });
});

describe('duplicateCard', () => {
  it('põe a cópia logo abaixo, com número novo e o histórico de origem', () => {
    const next = duplicateCard({
      board,
      cardId: 'p',
      newId: 'card-9',
      at: 'agora',
    });
    expect(titles(next)[0]).toEqual(['Pai', 'Pai (cópia)', 'A']);
    expect(next.lanes[0]?.cards[1]).toMatchObject({
      id: 'card-9',
      number: 4,
      activity: [{ at: 'agora', kind: 'duplicated', from: 'QD-1' }],
    });
    expect(next.nextNumber).toBe(5);
    expect(
      duplicateCard({ board, cardId: 'x', newId: 'card-9', at: 'agora' }),
    ).toBe(board);
  });
});

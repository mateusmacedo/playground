import { createBoard } from './board-state';
import { cardKey, findByKey, parseCardKey } from './card-key';

describe('createBoard', () => {
  it('numera na ordem da tela os cards que chegam sem número', () => {
    const board = createBoard({
      lanes: [
        { id: 'a', title: 'A', cards: [{ id: 'x', title: 'X' }] },
        {
          id: 'b',
          title: 'B',
          cards: [
            { id: 'y', title: 'Y', number: 7 },
            { id: 'z', title: 'Z' },
          ],
        },
      ],
    });
    expect(board.lanes.flatMap((lane) => lane.cards.map(cardKey))).toEqual([
      'QD-8',
      'QD-7',
      'QD-9',
    ]);
    expect(board.nextNumber).toBe(10);
    expect(board.labels).toEqual([]);
    expect(board.archive).toEqual([]);
  });

  it('mantém o próximo número gravado quando ele está à frente e a coluna já numerada', () => {
    const lane = {
      id: 'a',
      title: 'A',
      cards: [{ id: 'x', title: 'X', number: 1 }],
    };
    const board = createBoard({
      lanes: [lane],
      nextNumber: 20,
      archive: [
        {
          id: 'w',
          archivedAt: 'agora',
          cards: [{ laneId: 'a', card: { id: 'w', title: 'W', number: 3 } }],
        },
      ],
    });
    expect(board.lanes[0]).toBe(lane);
    expect(board.nextNumber).toBe(20);
  });
});

describe('código do card', () => {
  const board = createBoard({
    lanes: [
      { id: 'a', title: 'A', cards: [{ id: 'x', title: 'X', number: 1 }] },
    ],
    archive: [
      {
        id: 'w',
        archivedAt: 'agora',
        cards: [{ laneId: 'a', card: { id: 'w', title: 'W', number: 2 } }],
      },
    ],
  });

  it('forma e lê o código, sem diferenciar maiúsculas', () => {
    expect(cardKey({ number: 12 })).toBe('QD-12');
    expect(cardKey({})).toBe('QD-?');
    expect(parseCardKey(' qd-12 ')).toBe(12);
    expect(parseCardKey('XY-12')).toBeUndefined();
  });

  it('acha o card no quadro, no arquivo ou em lugar nenhum', () => {
    expect(findByKey({ board, key: 'QD-1' })).toEqual({
      kind: 'live',
      cardId: 'x',
    });
    expect(findByKey({ board, key: 'QD-2' })).toEqual({
      kind: 'archived',
      cardId: 'w',
    });
    expect(findByKey({ board, key: 'QD-9' })).toEqual({ kind: 'missing' });
    expect(findByKey({ board, key: 'lixo' })).toEqual({ kind: 'missing' });
  });
});

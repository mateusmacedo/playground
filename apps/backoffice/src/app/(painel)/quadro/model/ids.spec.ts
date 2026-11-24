import type { BoardLane } from './board';
import { nextCardId, nextId, nextLaneId } from './ids';

describe('nextId', () => {
  it('começa do 1 e segue o maior número em uso com o prefixo', () => {
    expect(nextId({ prefix: 'card', taken: [] })).toBe('card-1');
    expect(
      nextId({ prefix: 'card', taken: ['card-2', 'card-10', 'card-3'] }),
    ).toBe('card-11');
  });

  it('ignora ids de outro formato ou de outro prefixo', () => {
    expect(
      nextId({
        prefix: 'card',
        taken: ['item-7', 'card-x', 'cards-9', 'card-', 'card-4b'],
      }),
    ).toBe('card-1');
  });
});

describe('nextLaneId e nextCardId', () => {
  const lanes: readonly BoardLane[] = [
    {
      id: 'lane-2',
      title: 'A',
      cards: [
        { id: 'card-5', title: 'X' },
        { id: 'item-1', title: 'Y' },
      ],
    },
    { id: 'todo', title: 'B', cards: [{ id: 'card-1', title: 'Z' }] },
  ];

  it('olham colunas e cards do quadro inteiro', () => {
    expect(nextLaneId(lanes)).toBe('lane-3');
    expect(nextCardId(lanes)).toBe('card-6');
  });
});

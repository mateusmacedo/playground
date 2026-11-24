import type { BoardLane } from './board';
import {
  ancestorsOf,
  childCounts,
  childrenOf,
  descendantIds,
  parentCandidates,
  setParent,
} from './hierarchy';

// Hierarquia: a > b > c, e d solto; b fica em outra coluna para mostrar que a relação atravessa colunas.
const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'a', title: 'A' },
      { id: 'c', title: 'C', parentId: 'b' },
      { id: 'd', title: 'D' },
    ],
  },
  {
    id: 'doing',
    title: 'Em andamento',
    cards: [{ id: 'b', title: 'B', parentId: 'a' }],
  },
];

const ids = (cards: readonly { id: string }[]) => cards.map((card) => card.id);

describe('childrenOf e descendantIds', () => {
  it('lista os filhos diretos e todos os descendentes', () => {
    expect(ids(childrenOf({ lanes, cardId: 'a' }))).toEqual(['b']);
    expect(ids(childrenOf({ lanes, cardId: 'd' }))).toEqual([]);
    expect([...descendantIds({ lanes, cardId: 'a' })]).toEqual(['b', 'c']);
  });
});

describe('childCounts', () => {
  it('conta os filhos diretos de cada card que tem filhos', () => {
    expect([...childCounts(lanes)]).toEqual([
      ['b', 1],
      ['a', 1],
    ]);
  });
});

describe('ancestorsOf', () => {
  it('sobe do pai direto até a raiz', () => {
    expect(ids(ancestorsOf({ lanes, cardId: 'c' }))).toEqual(['b', 'a']);
    expect(ids(ancestorsOf({ lanes, cardId: 'a' }))).toEqual([]);
  });

  it('para num pai inexistente e num ciclo', () => {
    const broken: readonly BoardLane[] = [
      {
        id: 'l',
        title: 'L',
        cards: [
          { id: 'x', title: 'X', parentId: 'ghost' },
          { id: 'y', title: 'Y', parentId: 'z' },
          { id: 'z', title: 'Z', parentId: 'y' },
        ],
      },
    ];
    expect(ancestorsOf({ lanes: broken, cardId: 'x' })).toEqual([]);
    expect(ids(ancestorsOf({ lanes: broken, cardId: 'y' }))).toEqual(['z']);
  });
});

describe('parentCandidates', () => {
  it('deixa de fora o próprio card e os descendentes dele', () => {
    expect(ids(parentCandidates({ lanes, cardId: 'a' }))).toEqual(['d']);
    expect(ids(parentCandidates({ lanes, cardId: 'c' }))).toEqual([
      'a',
      'd',
      'b',
    ]);
  });
});

describe('setParent', () => {
  it('liga o card a um pai em qualquer coluna e solta com undefined', () => {
    const linked = setParent({ lanes, cardId: 'd', parentId: 'b' });
    expect(ids(childrenOf({ lanes: linked, cardId: 'b' }))).toEqual(['c', 'd']);
    const released = setParent({
      lanes: linked,
      cardId: 'd',
      parentId: undefined,
    });
    expect(ids(childrenOf({ lanes: released, cardId: 'b' }))).toEqual(['c']);
  });

  it('recusa ciclo, o próprio card, pai inexistente e pai igual', () => {
    expect(setParent({ lanes, cardId: 'a', parentId: 'c' })).toBe(lanes);
    expect(setParent({ lanes, cardId: 'a', parentId: 'a' })).toBe(lanes);
    expect(setParent({ lanes, cardId: 'a', parentId: 'ghost' })).toBe(lanes);
    expect(setParent({ lanes, cardId: 'b', parentId: 'a' })).toBe(lanes);
    expect(setParent({ lanes, cardId: 'ghost', parentId: 'a' })).toBe(lanes);
  });
});

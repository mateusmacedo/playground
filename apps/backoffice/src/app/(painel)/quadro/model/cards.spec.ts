import type { BoardLane } from './board';
import { addCard, moveCardToLane, removeCard, updateCard } from './cards';

const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'a', title: 'A', description: 'Texto' },
      { id: 'b', title: 'B', parentId: 'a' },
    ],
  },
  {
    id: 'doing',
    title: 'Em andamento',
    cards: [{ id: 'c', title: 'C', parentId: 'b' }],
  },
];

const titles = (board: readonly BoardLane[], index: number) =>
  board[index]?.cards.map((card) => card.title);

describe('addCard', () => {
  it('acrescenta o card no fim da coluna, já com o pai', () => {
    const next = addCard({
      lanes,
      laneId: 'doing',
      card: { id: 'd', title: ' Novo ', parentId: 'a' },
    });
    expect(next[1]?.cards.at(-1)).toEqual({
      id: 'd',
      title: 'Novo',
      parentId: 'a',
    });
  });

  it('guarda o número do card quando ele vem junto', () => {
    const next = addCard({
      lanes,
      laneId: 'todo',
      card: { id: 'd', title: 'D', number: 7 },
    });
    expect(next[0]?.cards.at(-1)?.number).toBe(7);
  });

  it('não cria card sem título ou em coluna inexistente', () => {
    const card = { id: 'd', title: 'D' };
    expect(
      addCard({ lanes, laneId: 'todo', card: { ...card, title: ' ' } }),
    ).toBe(lanes);
    expect(addCard({ lanes, laneId: 'ghost', card })).toBe(lanes);
  });
});

describe('updateCard', () => {
  it('troca título e descrição, e descrição vazia some', () => {
    const next = updateCard({
      lanes,
      cardId: 'a',
      patch: { title: ' Novo A ', description: '  ' },
    });
    expect(next[0]?.cards[0]).toEqual({ id: 'a', title: 'Novo A' });
  });

  it('guarda a descrição como foi digitada, com os espaços', () => {
    const next = updateCard({
      lanes,
      cardId: 'a',
      patch: { description: 'Linha 1 ' },
    });
    expect(next[0]?.cards[0]?.description).toBe('Linha 1 ');
  });

  it('mantém o título anterior quando ele chega vazio', () => {
    const next = updateCard({
      lanes,
      cardId: 'b',
      patch: { title: '', description: 'Detalhe' },
    });
    expect(next[0]?.cards[1]).toMatchObject({
      title: 'B',
      description: 'Detalhe',
    });
  });

  it('devolve o mesmo quadro sem mudança ou com card inexistente', () => {
    expect(updateCard({ lanes, cardId: 'a', patch: { title: 'A' } })).toBe(
      lanes,
    );
    expect(updateCard({ lanes, cardId: 'a', patch: {} })).toBe(lanes);
    expect(updateCard({ lanes, cardId: 'x', patch: { title: 'X' } })).toBe(
      lanes,
    );
  });
});

describe('moveCardToLane', () => {
  it('leva o card para o fim da outra coluna', () => {
    const next = moveCardToLane({ lanes, cardId: 'a', laneId: 'doing' });
    expect(titles(next, 0)).toEqual(['B']);
    expect(titles(next, 1)).toEqual(['C', 'A']);
  });

  it('não muda nada na própria coluna ou com card inexistente', () => {
    expect(moveCardToLane({ lanes, cardId: 'a', laneId: 'todo' })).toBe(lanes);
    expect(moveCardToLane({ lanes, cardId: 'x', laneId: 'todo' })).toBe(lanes);
  });
});

describe('removeCard', () => {
  it('exclui o card e sobe os filhos para o pai dele', () => {
    const next = removeCard({ lanes, cardId: 'b' });
    expect(titles(next, 0)).toEqual(['A']);
    expect(next[1]?.cards[0]?.parentId).toBe('a');
  });

  it('deixa os filhos sem pai quando o card excluído é raiz', () => {
    const next = removeCard({ lanes, cardId: 'a' });
    expect(next[0]?.cards[0]?.parentId).toBeUndefined();
  });

  it('devolve o mesmo quadro com card inexistente', () => {
    expect(removeCard({ lanes, cardId: 'x' })).toBe(lanes);
  });
});

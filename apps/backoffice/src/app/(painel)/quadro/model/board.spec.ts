import { type BoardLane, findCard } from './board';
import { moveCard, slotToIndex, stepCard } from './card-moves';

function card(id: string) {
  return { id, title: `Item ${id}` };
}

const lanes: readonly BoardLane[] = [
  { id: 'todo', title: 'A fazer', cards: [card('a'), card('b'), card('c')] },
  { id: 'doing', title: 'Em andamento', cards: [card('d')] },
  { id: 'done', title: 'Concluído', cards: [] },
];

/** Quadro em texto curto, para comparar a ordem: `todo:a,b,c`. */
function layout(board: readonly BoardLane[]): string[] {
  return board.map(
    (lane) => `${lane.id}:${lane.cards.map((item) => item.id).join(',')}`,
  );
}

describe('findCard', () => {
  it('acha a coluna e a posição do card', () => {
    const location = findCard({ lanes, cardId: 'b' });

    expect(location?.lane.id).toBe('todo');
    expect(location?.laneIndex).toBe(0);
    expect(location?.cardIndex).toBe(1);
    expect(location?.card.title).toBe('Item b');
  });

  it('devolve undefined para card que não existe', () => {
    expect(findCard({ lanes, cardId: 'x' })).toBeUndefined();
  });
});

describe('moveCard', () => {
  it('leva o card para outra coluna na posição pedida', () => {
    const board = moveCard({
      lanes,
      cardId: 'b',
      toLaneId: 'doing',
      toIndex: 0,
    });

    expect(layout(board)).toEqual(['todo:a,c', 'doing:b,d', 'done:']);
  });

  it('aceita coluna vazia como destino', () => {
    const board = moveCard({
      lanes,
      cardId: 'd',
      toLaneId: 'done',
      toIndex: 0,
    });

    expect(layout(board)).toEqual(['todo:a,b,c', 'doing:', 'done:d']);
  });

  it('reordena dentro da mesma coluna, para baixo e para cima', () => {
    expect(
      layout(moveCard({ lanes, cardId: 'a', toLaneId: 'todo', toIndex: 2 })),
    ).toEqual(['todo:b,c,a', 'doing:d', 'done:']);
    expect(
      layout(moveCard({ lanes, cardId: 'c', toLaneId: 'todo', toIndex: 0 })),
    ).toEqual(['todo:c,a,b', 'doing:d', 'done:']);
  });

  it('leva posição fora da faixa para a ponta mais próxima', () => {
    expect(
      layout(moveCard({ lanes, cardId: 'a', toLaneId: 'doing', toIndex: 99 })),
    ).toEqual(['todo:b,c', 'doing:d,a', 'done:']);
    expect(
      layout(moveCard({ lanes, cardId: 'd', toLaneId: 'todo', toIndex: -5 })),
    ).toEqual(['todo:d,a,b,c', 'doing:', 'done:']);
  });

  it('devolve o mesmo quadro quando o card já está no lugar pedido', () => {
    expect(moveCard({ lanes, cardId: 'b', toLaneId: 'todo', toIndex: 1 })).toBe(
      lanes,
    );
  });

  it('devolve o mesmo quadro para card ou coluna que não existem', () => {
    expect(moveCard({ lanes, cardId: 'x', toLaneId: 'todo', toIndex: 0 })).toBe(
      lanes,
    );
    expect(moveCard({ lanes, cardId: 'a', toLaneId: 'x', toIndex: 0 })).toBe(
      lanes,
    );
  });

  it('não altera o quadro original e preserva as colunas que não mudaram', () => {
    const board = moveCard({
      lanes,
      cardId: 'a',
      toLaneId: 'doing',
      toIndex: 1,
    });

    expect(layout(lanes)).toEqual(['todo:a,b,c', 'doing:d', 'done:']);
    expect(board[2]).toBe(lanes[2]);
  });
});

describe('slotToIndex', () => {
  it('desconta o próprio card quando a fenda fica abaixo dele na mesma coluna', () => {
    expect(slotToIndex({ lanes, cardId: 'a', laneId: 'todo', slot: 3 })).toBe(
      2,
    );
  });

  it('mantém a fenda acima da origem, em outra coluna ou para card desconhecido', () => {
    expect(slotToIndex({ lanes, cardId: 'c', laneId: 'todo', slot: 0 })).toBe(
      0,
    );
    expect(slotToIndex({ lanes, cardId: 'b', laneId: 'todo', slot: 1 })).toBe(
      1,
    );
    expect(slotToIndex({ lanes, cardId: 'a', laneId: 'doing', slot: 1 })).toBe(
      1,
    );
    expect(slotToIndex({ lanes, cardId: 'x', laneId: 'todo', slot: 2 })).toBe(
      2,
    );
  });
});

describe('stepCard', () => {
  it('sobe e desce uma posição na mesma coluna', () => {
    expect(layout(stepCard({ lanes, cardId: 'a', direction: 'down' }))).toEqual(
      ['todo:b,a,c', 'doing:d', 'done:'],
    );
    expect(layout(stepCard({ lanes, cardId: 'c', direction: 'up' }))).toEqual([
      'todo:a,c,b',
      'doing:d',
      'done:',
    ]);
  });

  it('vai para a coluna vizinha na mesma altura, limitada ao fim dela', () => {
    expect(
      layout(stepCard({ lanes, cardId: 'c', direction: 'right' })),
    ).toEqual(['todo:a,b', 'doing:d,c', 'done:']);
    expect(layout(stepCard({ lanes, cardId: 'd', direction: 'left' }))).toEqual(
      ['todo:d,a,b,c', 'doing:', 'done:'],
    );
  });

  it('não sai do quadro nem passa das pontas da coluna', () => {
    expect(stepCard({ lanes, cardId: 'a', direction: 'up' })).toBe(lanes);
    expect(stepCard({ lanes, cardId: 'c', direction: 'down' })).toBe(lanes);
    expect(stepCard({ lanes, cardId: 'a', direction: 'left' })).toBe(lanes);
    expect(
      stepCard({
        lanes: [
          lanes[0] as BoardLane,
          { id: 'last', title: 'Última', cards: [card('z')] },
        ],
        cardId: 'z',
        direction: 'right',
      }),
    ).toEqual([lanes[0], { id: 'last', title: 'Última', cards: [card('z')] }]);
  });

  it('devolve o mesmo quadro para card que não existe', () => {
    expect(stepCard({ lanes, cardId: 'x', direction: 'down' })).toBe(lanes);
  });
});

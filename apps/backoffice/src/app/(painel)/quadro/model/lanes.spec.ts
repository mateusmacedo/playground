import type { BoardLane } from './board';
import {
  addLane,
  isOverLimit,
  laneSlotToIndex,
  moveLane,
  removeLane,
  renameLane,
  setWipLimit,
  stepLane,
} from './lanes';

const lanes: readonly BoardLane[] = [
  { id: 'a', title: 'A', cards: [{ id: 'x', title: 'X' }] },
  { id: 'b', title: 'B', cards: [{ id: 'y', title: 'Y' }] },
  { id: 'c', title: 'C', cards: [] },
];

const order = (board: readonly BoardLane[]) => board.map((lane) => lane.id);

describe('addLane', () => {
  it('acrescenta a coluna vazia no fim, com o nome sem espaços nas pontas', () => {
    const next = addLane({ lanes, lane: { id: 'd', title: '  Nova  ' } });
    expect(next.at(-1)).toEqual({ id: 'd', title: 'Nova', cards: [] });
    expect(next).toHaveLength(4);
  });

  it('não cria coluna sem nome', () => {
    expect(addLane({ lanes, lane: { id: 'd', title: '   ' } })).toBe(lanes);
  });
});

describe('renameLane', () => {
  it('troca o nome da coluna', () => {
    const next = renameLane({ lanes, laneId: 'b', title: ' Revisão ' });
    expect(next[1]?.title).toBe('Revisão');
    expect(next[0]).toBe(lanes[0]);
  });

  it('mantém o quadro com nome vazio, igual ou coluna inexistente', () => {
    expect(renameLane({ lanes, laneId: 'b', title: '' })).toBe(lanes);
    expect(renameLane({ lanes, laneId: 'b', title: 'B' })).toBe(lanes);
    expect(renameLane({ lanes, laneId: 'z', title: 'Z' })).toBe(lanes);
  });
});

describe('removeLane', () => {
  it('exclui a coluna vazia sem pedir destino', () => {
    expect(order(removeLane({ lanes, laneId: 'c' }))).toEqual(['a', 'b']);
  });

  it('leva os cards para o fim da coluna de destino', () => {
    const next = removeLane({ lanes, laneId: 'a', moveCardsTo: 'b' });
    expect(order(next)).toEqual(['b', 'c']);
    expect(next[0]?.cards.map((card) => card.id)).toEqual(['y', 'x']);
  });

  it('não exclui coluna com cards sem destino válido', () => {
    expect(removeLane({ lanes, laneId: 'a' })).toBe(lanes);
    expect(removeLane({ lanes, laneId: 'a', moveCardsTo: 'a' })).toBe(lanes);
    expect(removeLane({ lanes, laneId: 'a', moveCardsTo: 'z' })).toBe(lanes);
  });

  it('não exclui a última coluna nem coluna inexistente', () => {
    const single = [lanes[2]] as readonly BoardLane[];
    expect(removeLane({ lanes: single, laneId: 'c' })).toBe(single);
    expect(removeLane({ lanes, laneId: 'z' })).toBe(lanes);
  });
});

describe('moveLane', () => {
  it('coloca a coluna na posição final pedida', () => {
    expect(order(moveLane({ lanes, laneId: 'a', toIndex: 2 }))).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(order(moveLane({ lanes, laneId: 'c', toIndex: 0 }))).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('leva posições fora da faixa para a ponta mais próxima', () => {
    expect(order(moveLane({ lanes, laneId: 'b', toIndex: 99 }))).toEqual([
      'a',
      'c',
      'b',
    ]);
    expect(order(moveLane({ lanes, laneId: 'b', toIndex: -3 }))).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('devolve o mesmo quadro sem mudança ou com coluna inexistente', () => {
    expect(moveLane({ lanes, laneId: 'b', toIndex: 1 })).toBe(lanes);
    expect(moveLane({ lanes, laneId: 'z', toIndex: 0 })).toBe(lanes);
  });
});

describe('laneSlotToIndex', () => {
  it('desconta a própria coluna quando a fenda fica à direita dela', () => {
    expect(laneSlotToIndex({ lanes, laneId: 'a', slot: 3 })).toBe(2);
    expect(laneSlotToIndex({ lanes, laneId: 'a', slot: 1 })).toBe(0);
    expect(laneSlotToIndex({ lanes, laneId: 'c', slot: 0 })).toBe(0);
    expect(laneSlotToIndex({ lanes, laneId: 'z', slot: 2 })).toBe(2);
  });
});

describe('stepLane', () => {
  it('troca de lugar com a vizinha', () => {
    expect(order(stepLane({ lanes, laneId: 'b', direction: 'left' }))).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(order(stepLane({ lanes, laneId: 'b', direction: 'right' }))).toEqual(
      ['a', 'c', 'b'],
    );
  });

  it('não passa das pontas nem move coluna inexistente', () => {
    expect(stepLane({ lanes, laneId: 'a', direction: 'left' })).toBe(lanes);
    expect(stepLane({ lanes, laneId: 'c', direction: 'right' })).toBe(lanes);
    expect(stepLane({ lanes, laneId: 'z', direction: 'left' })).toBe(lanes);
  });
});

describe('setWipLimit e isOverLimit', () => {
  it('define e tira o limite', () => {
    const limited = setWipLimit({ lanes, laneId: 'a', limit: 2 });
    expect(limited[0]?.wipLimit).toBe(2);
    const cleared = setWipLimit({
      lanes: limited,
      laneId: 'a',
      limit: undefined,
    });
    expect(cleared[0]?.wipLimit).toBeUndefined();
  });

  it('ignora limite inválido, igual ou de coluna inexistente', () => {
    expect(setWipLimit({ lanes, laneId: 'a', limit: 0 })).toBe(lanes);
    expect(setWipLimit({ lanes, laneId: 'a', limit: 1.5 })).toBe(lanes);
    expect(setWipLimit({ lanes, laneId: 'a', limit: undefined })).toBe(lanes);
    expect(setWipLimit({ lanes, laneId: 'z', limit: 3 })).toBe(lanes);
  });

  it('aponta a coluna com mais cards que o limite', () => {
    const lane = lanes[0] as BoardLane;
    expect(isOverLimit(lane)).toBe(false);
    expect(isOverLimit({ ...lane, wipLimit: 1 })).toBe(false);
    expect(
      isOverLimit({
        ...lane,
        wipLimit: 1,
        cards: [...lane.cards, ...lane.cards],
      }),
    ).toBe(true);
  });
});

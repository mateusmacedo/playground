import type { Board } from './board';
import { addCard } from './cards';
import {
  doneLaneOf,
  enteredDone,
  movedIntoDone,
  moveToDone,
} from './done-lane';
import { DONE_LANE, laneCardIds, processBoard } from './process-test-data';

interface LockParams {
  readonly board: Board;
  readonly laneId: string;
}

function withLockedLane(params: LockParams): Board {
  const { board, laneId } = params;
  return {
    ...board,
    lanes: board.lanes.map((lane) =>
      lane.id === laneId ? { ...lane, locked: true } : lane,
    ),
  };
}

describe('doneLaneOf', () => {
  it('encontra a coluna de conclusão e ignora a que não existe mais', () => {
    const board = processBoard();
    expect(doneLaneOf(board)?.id).toBe(DONE_LANE);
    expect(doneLaneOf(processBoard({ withoutDoneLane: true }))).toBeUndefined();
    const gone = { ...board, config: { ...board.config, doneLaneId: 'x' } };
    expect(doneLaneOf(gone)).toBeUndefined();
  });
});

describe('enteredDone e movedIntoDone', () => {
  it('separam o card levado de outra coluna do criado na coluna de conclusão', () => {
    const before = processBoard({ todo: [{ id: 'a', title: 'A' }] });
    const moved = moveToDone({ board: before, cardId: 'a' });
    const lanes = addCard({
      lanes: moved.lanes,
      laneId: DONE_LANE,
      card: { id: 'n', title: 'Novo' },
    });
    const after = { ...moved, lanes };
    expect(enteredDone({ before, after }).map((card) => card.id)).toEqual([
      'a',
      'n',
    ]);
    expect(movedIntoDone({ before, after }).map((card) => card.id)).toEqual([
      'a',
    ]);
  });

  it('não contam nada sem coluna de conclusão', () => {
    const board = processBoard({
      todo: [{ id: 'a', title: 'A' }],
      withoutDoneLane: true,
    });
    expect(enteredDone({ before: board, after: board })).toEqual([]);
  });

  it('não contam os cards da coluna que passou a ser a de conclusão', () => {
    const before = processBoard({
      todo: [{ id: 'a', title: 'A' }],
      withoutDoneLane: true,
    });
    const after = {
      ...before,
      config: { ...before.config, doneLaneId: 'todo' },
    };
    expect(enteredDone({ before, after })).toEqual([]);
  });
});

describe('moveToDone', () => {
  const board = processBoard({
    todo: [{ id: 'a', title: 'A' }],
    done: [{ id: 'd', title: 'D' }],
  });

  it('leva o card para o fim da coluna de conclusão', () => {
    const next = moveToDone({ board, cardId: 'a' });
    expect(laneCardIds({ board: next, laneId: DONE_LANE })).toEqual(['d', 'a']);
  });

  it('não mexe no quadro quando não há para onde ou o que levar', () => {
    expect(moveToDone({ board, cardId: 'd' })).toBe(board);
    expect(moveToDone({ board, cardId: 'x' })).toBe(board);
    const without = {
      ...board,
      config: { ...board.config, doneLaneId: undefined },
    };
    expect(moveToDone({ board: without, cardId: 'a' })).toBe(without);
  });

  it('respeita a coluna bloqueada, de origem ou de conclusão', () => {
    const lockedDone = withLockedLane({ board, laneId: DONE_LANE });
    const lockedTodo = withLockedLane({ board, laneId: 'todo' });
    expect(moveToDone({ board: lockedDone, cardId: 'a' })).toBe(lockedDone);
    expect(moveToDone({ board: lockedTodo, cardId: 'a' })).toBe(lockedTodo);
  });
});

import type { Board, BoardCard } from './board';
import {
  convertChecklistItem,
  ITEM_MISSING,
  UNNAMED_ITEM_TITLE,
} from './checklist-convert';
import { CARD_MISSING } from './process-run';
import {
  CHANGED_AT,
  cardOf,
  laneCardIds,
  processBoard,
} from './process-test-data';

const parent: BoardCard = {
  id: 'p',
  title: 'Pai',
  assigneeId: 'ana',
  labelIds: ['urgente'],
  checklist: [
    { id: 'item-1', text: 'Comprar', done: false },
    { id: 'item-2', text: 'Pagar', done: false },
  ],
};

function convert(board: Board, itemId = 'item-1') {
  return convertChecklistItem({
    board,
    cardId: 'p',
    itemId,
    newId: 'f',
    at: CHANGED_AT,
  });
}

function acceptedBoard(result: ReturnType<typeof convert>): Board {
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.board;
}

describe('convertChecklistItem', () => {
  it('tira o item do checklist e cria o card filho com o texto dele no fim da coluna do pai', () => {
    const board = processBoard({ doing: [parent, { id: 'x', title: 'X' }] });
    const next = acceptedBoard(convert(board));
    expect(cardOf({ board: next, cardId: 'p' }).checklist).toEqual([
      { id: 'item-2', text: 'Pagar', done: false },
    ]);
    expect(laneCardIds({ board: next, laneId: 'doing' })).toEqual([
      'p',
      'x',
      'f',
    ]);
    expect(cardOf({ board: next, cardId: 'f' })).toEqual({
      id: 'f',
      title: 'Comprar',
      parentId: 'p',
      number: board.nextNumber,
      activity: [
        {
          at: CHANGED_AT,
          kind: 'from-checklist',
          lane: 'Em andamento',
          parent: 'Pai',
        },
      ],
    });
    expect(next.nextNumber).toBe(board.nextNumber + 1);
  });

  it('herda o responsável e as etiquetas do pai com a regra ligada', () => {
    const board = processBoard({
      todo: [parent],
      rules: { childInherits: true },
    });
    const child = cardOf({ board: acceptedBoard(convert(board)), cardId: 'f' });
    expect(child).toMatchObject({ assigneeId: 'ana', labelIds: ['urgente'] });
  });

  it('dá um título ao item sem texto', () => {
    const blank: BoardCard = {
      id: 'p',
      title: 'Pai',
      checklist: [{ id: 'item-1', text: '  ', done: false }],
    };
    const next = acceptedBoard(convert(processBoard({ todo: [blank] })));
    expect(cardOf({ board: next, cardId: 'f' }).title).toBe(UNNAMED_ITEM_TITLE);
    expect(cardOf({ board: next, cardId: 'p' }).checklist).toBeUndefined();
  });

  it('recusa o card ou o item que não existem', () => {
    expect(convert(processBoard())).toEqual({
      ok: false,
      message: CARD_MISSING,
    });
    expect(convert(processBoard({ todo: [parent] }), 'item-9')).toEqual({
      ok: false,
      message: ITEM_MISSING,
    });
    const empty = processBoard({ todo: [{ id: 'p', title: 'Pai' }] });
    expect(convert(empty)).toEqual({ ok: false, message: ITEM_MISSING });
  });

  it('recusa a coluna bloqueada', () => {
    const board = processBoard({ todo: [parent] });
    const locked: Board = {
      ...board,
      lanes: board.lanes.map((lane) =>
        lane.id === 'todo' ? { ...lane, locked: true } : lane,
      ),
    };
    expect(convert(locked)).toEqual({
      ok: false,
      message:
        'A coluna A fazer está bloqueada: libere a coluna para criar o card filho.',
    });
  });
});

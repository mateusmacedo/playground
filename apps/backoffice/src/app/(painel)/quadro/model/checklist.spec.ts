import type { BoardLane } from './board';
import {
  addChecklistItem,
  checklistProgress,
  removeChecklistItem,
  toggleChecklistItem,
} from './checklist';

const lanes: readonly BoardLane[] = [
  { id: 'a', title: 'A', cards: [{ id: 'x', title: 'X' }] },
];

const card = (board: readonly BoardLane[]) => board[0]?.cards[0];

describe('checklist', () => {
  it('inclui, marca, desmarca e remove itens', () => {
    let board = addChecklistItem({ lanes, cardId: 'x', text: ' Passo 1 ' });
    board = addChecklistItem({ lanes: board, cardId: 'x', text: 'Passo 2' });
    expect(card(board)?.checklist).toEqual([
      { id: 'item-1', text: 'Passo 1', done: false },
      { id: 'item-2', text: 'Passo 2', done: false },
    ]);

    board = toggleChecklistItem({
      lanes: board,
      cardId: 'x',
      itemId: 'item-1',
    });
    expect(checklistProgress(card(board) ?? { id: '', title: '' })).toEqual({
      done: 1,
      total: 2,
    });
    board = toggleChecklistItem({
      lanes: board,
      cardId: 'x',
      itemId: 'item-1',
    });
    expect(card(board)?.checklist?.[0]?.done).toBe(false);

    board = removeChecklistItem({
      lanes: board,
      cardId: 'x',
      itemId: 'item-1',
    });
    board = removeChecklistItem({
      lanes: board,
      cardId: 'x',
      itemId: 'item-2',
    });
    expect(card(board)?.checklist).toBeUndefined();
  });

  it('ignora texto vazio e item inexistente', () => {
    expect(addChecklistItem({ lanes, cardId: 'x', text: '  ' })).toBe(lanes);
    expect(toggleChecklistItem({ lanes, cardId: 'x', itemId: 'nada' })).toBe(
      lanes,
    );
    expect(removeChecklistItem({ lanes, cardId: 'x', itemId: 'nada' })).toBe(
      lanes,
    );
    expect(checklistProgress({ id: 'x', title: 'X' })).toEqual({
      done: 0,
      total: 0,
    });
  });
});

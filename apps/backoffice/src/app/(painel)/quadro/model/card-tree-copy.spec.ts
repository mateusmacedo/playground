import { begin } from '@/shared/process/engine-test-kit';
import { linearPlan } from '@/shared/process/engine-test-plans';

import type { Board } from './board';
import { duplicateCardTree, type TreeCopyResult } from './card-tree-copy';
import { CARD_MISSING } from './process-run';
import {
  CHANGED_AT,
  cardOf,
  laneCardIds,
  processBoard,
} from './process-test-data';

// r tem o filho a (em outra coluna), que tem o neto b; s é irmão de r e fica de fora.
function treeBoard(): Board {
  return processBoard({
    todo: [
      { id: 'card-1', title: 'Raiz', parentId: 'card-9', number: 1 },
      { id: 'card-3', title: 'Neto', parentId: 'card-2', number: 3 },
      { id: 'card-9', title: 'Avô', number: 9 },
    ],
    doing: [
      {
        id: 'card-2',
        title: 'Filho',
        parentId: 'card-1',
        number: 2,
        blockedBy: ['card-9'],
        process: begin(linearPlan),
        stepOf: { cardId: 'card-9', tokenId: 't-1' },
        comments: [{ id: 'c-1', at: CHANGED_AT, author: 'Ana', text: 'Oi' }],
      },
    ],
  });
}

function copied(result: TreeCopyResult) {
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result;
}

describe('duplicateCardTree', () => {
  it('copia o card e as descendentes logo abaixo dos originais, com a mesma hierarquia', () => {
    const board = treeBoard();
    const result = copied(
      duplicateCardTree({ board, cardId: 'card-1', at: CHANGED_AT }),
    );
    const next = result.board;
    expect(result.copyId).toBe('card-10');
    expect(laneCardIds({ board: next, laneId: 'todo' })).toEqual([
      'card-1',
      'card-10',
      'card-3',
      'card-12',
      'card-9',
    ]);
    expect(laneCardIds({ board: next, laneId: 'doing' })).toEqual([
      'card-2',
      'card-11',
    ]);
    expect(cardOf({ board: next, cardId: 'card-10' })).toMatchObject({
      title: 'Raiz (cópia)',
      parentId: 'card-9',
      number: board.nextNumber,
      activity: [{ at: CHANGED_AT, kind: 'duplicated', from: 'QD-1' }],
    });
    expect(cardOf({ board: next, cardId: 'card-11' })).toMatchObject({
      title: 'Filho',
      parentId: 'card-10',
      number: board.nextNumber + 1,
      comments: [{ id: 'c-1', at: CHANGED_AT, author: 'Ana', text: 'Oi' }],
    });
    expect(cardOf({ board: next, cardId: 'card-12' })).toMatchObject({
      title: 'Neto',
      parentId: 'card-11',
      number: board.nextNumber + 2,
    });
    expect(next.nextNumber).toBe(board.nextNumber + 3);
  });

  it('deixa a execução, a etapa e os bloqueadores só no original', () => {
    const next = copied(
      duplicateCardTree({
        board: treeBoard(),
        cardId: 'card-1',
        at: CHANGED_AT,
      }),
    ).board;
    const copy = cardOf({ board: next, cardId: 'card-11' });
    expect(copy.process).toBeUndefined();
    expect(copy.stepOf).toBeUndefined();
    expect(copy.blockedBy).toBeUndefined();
    expect(cardOf({ board: next, cardId: 'card-2' }).blockedBy).toEqual([
      'card-9',
    ]);
  });

  it('não repete o id de um card arquivado', () => {
    const board: Board = {
      ...processBoard({ todo: [{ id: 'card-1', title: 'Raiz' }] }),
      archive: [
        {
          id: 'card-5',
          archivedAt: CHANGED_AT,
          cards: [{ card: { id: 'card-5', title: 'Velho' }, laneId: 'todo' }],
        },
      ],
    };
    const result = copied(
      duplicateCardTree({ board, cardId: 'card-1', at: CHANGED_AT }),
    );
    expect(result.copyId).toBe('card-6');
  });

  it('recusa o card que não existe e a coluna bloqueada', () => {
    const board = treeBoard();
    expect(
      duplicateCardTree({ board, cardId: 'sumiu', at: CHANGED_AT }),
    ).toEqual({ ok: false, message: CARD_MISSING });
    const locked: Board = {
      ...board,
      lanes: board.lanes.map((lane) =>
        lane.id === 'doing' ? { ...lane, locked: true } : lane,
      ),
    };
    expect(
      duplicateCardTree({ board: locked, cardId: 'card-1', at: CHANGED_AT }),
    ).toEqual({
      ok: false,
      message:
        'A coluna Em andamento está bloqueada: libere a coluna para duplicar o card com os filhos.',
    });
  });
});

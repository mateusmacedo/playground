import { tokenAt } from '@/shared/process/engine-test-kit';

import type { Board } from './board';
import { applyChange, changeRefusal } from './board-change';
import { moveCard } from './card-moves';
import { moveToDone } from './done-lane';
import { startHistory, undo } from './history';
import { removeProcess } from './process-run';
import {
  boardProcess,
  CHANGED_AT,
  cardOf,
  DONE_LANE,
  delegatedPair,
  laneCardIds,
  processBoard,
  runningCard,
  runOf,
} from './process-test-data';

const guarded = processBoard({
  todo: [runningCard({ id: 'a' })],
  rules: { doneWaitsProcess: true },
  processes: [boardProcess()],
});

describe('changeRefusal', () => {
  it('explica a recusa das regras do quadro', () => {
    const history = startHistory(guarded);
    const next = moveToDone({ board: guarded, cardId: 'a' });
    expect(changeRefusal({ history, next })).toContain(
      'tem o processo Processo em andamento',
    );
  });

  it('não recusa quando nada muda', () => {
    const history = startHistory(guarded);
    expect(changeRefusal({ history, next: guarded })).toBeUndefined();
  });

  it('não recusa a volta ao começo do passo agrupado', () => {
    const start = processBoard({
      done: [runningCard({ id: 'a' })],
      rules: { doneWaitsProcess: true },
      processes: [boardProcess()],
    });
    const moved: Board = {
      ...start,
      lanes: moveCard({
        lanes: start.lanes,
        cardId: 'a',
        toLaneId: 'todo',
        toIndex: 0,
      }),
    };
    const first = applyChange({
      history: startHistory(start),
      next: moved,
      key: 'move',
      log: false,
      at: CHANGED_AT,
    });
    expect(
      changeRefusal({ history: first, next: start, key: 'move' }),
    ).toBeUndefined();
  });
});

describe('applyChange com as regras do quadro', () => {
  it('recusa a mudança sem criar passo no desfazer', () => {
    const history = startHistory(guarded);
    const next = moveToDone({ board: guarded, cardId: 'a' });
    expect(applyChange({ history, next, log: true, at: CHANGED_AT })).toBe(
      history,
    );
  });

  it('dispensa as regras quando pedido', () => {
    const history = startHistory(guarded);
    const next = moveToDone({ board: guarded, cardId: 'a' });
    const applied = applyChange({
      history,
      next,
      log: false,
      at: CHANGED_AT,
      rules: false,
    });
    expect(applied.present).toBe(next);
  });

  it('grava o que a mudança provoca no mesmo passo do desfazer', () => {
    const pair = delegatedPair({
      ownerId: 'owner',
      childId: 'child',
      stepRef: 'a',
    });
    const board = processBoard({
      todo: [pair.owner, pair.child],
      processes: [boardProcess()],
    });
    const history = applyChange({
      history: startHistory(board),
      next: moveToDone({ board, cardId: 'child' }),
      log: true,
      at: CHANGED_AT,
    });
    const owner = cardOf({ board: history.present, cardId: 'owner' });
    expect(tokenAt({ run: runOf(owner), stepRef: 'b' })).toBeDefined();
    expect(owner.activity?.at(-1)).toEqual({
      at: CHANGED_AT,
      kind: 'process-step',
      step: 'a',
      detail: undefined,
    });
    expect(laneCardIds({ board: history.present, laneId: DONE_LANE })).toEqual([
      'child',
    ]);
    expect(undo(history).present).toBe(board);
  });

  it('tira do quadro o roteiro que ficou sem uso', () => {
    const card = runningCard({ id: 'a' });
    const ended = { ...runOf(card), status: 'cancelled' as const };
    const board = processBoard({
      todo: [{ ...card, process: ended }],
      processes: [boardProcess()],
    });
    const history = applyChange({
      history: startHistory(board),
      next: removeProcess({ board, cardId: 'a' }),
      log: true,
      at: CHANGED_AT,
    });
    expect(history.present.processes).toBeUndefined();
    expect(cardOf({ board: history.present, cardId: 'a' }).activity).toEqual([
      { at: CHANGED_AT, kind: 'process-removed', name: 'Processo' },
    ]);
  });
});

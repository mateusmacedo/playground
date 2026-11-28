import { ALREADY_DELEGATED } from '@/shared/process/engine-result';
import { end, planOf, step, tokenAt } from '@/shared/process/engine-test-kit';

import type { Board } from './board';
import { CARD_MISSING } from './process-run';
import {
  boardProcess,
  CHANGED_AT,
  cardOf,
  laneCardIds,
  processBoard,
  runningCard,
  runOf,
} from './process-test-data';
import { delegateStep, UNNAMED_STEP_TITLE } from './step-delegation';

function ownerBoard(): Board {
  return processBoard({
    doing: [runningCard({ id: 'owner' })],
    processes: [boardProcess()],
  });
}

function ownerToken(board: Board): string {
  const run = runOf(cardOf({ board, cardId: 'owner' }));
  return tokenAt({ run, stepRef: 'a' }).id;
}

describe('delegateStep', () => {
  it('cria o card filho com o nome da etapa no fim da coluna do dono, ligado à ficha', () => {
    const board = ownerBoard();
    const tokenId = ownerToken(board);
    const change = delegateStep({
      board,
      cardId: 'owner',
      tokenId,
      newId: 'child',
      at: CHANGED_AT,
    });
    if (!change.ok) {
      throw new Error(change.message);
    }
    const child = cardOf({ board: change.board, cardId: 'child' });
    expect(laneCardIds({ board: change.board, laneId: 'doing' })).toEqual([
      'owner',
      'child',
    ]);
    expect(child).toMatchObject({
      title: 'a',
      parentId: 'owner',
      number: board.nextNumber,
      stepOf: { cardId: 'owner', tokenId },
    });
    expect(change.board.nextNumber).toBe(board.nextNumber + 1);
    const run = runOf(cardOf({ board: change.board, cardId: 'owner' }));
    expect(tokenAt({ run, stepRef: 'a' }).delegateId).toBe('child');
  });

  it('dá um nome ao card filho da etapa sem nome', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'a' }),
      step({ id: 'a', to: 'end', data: { label: '  ' } }),
      end({ id: 'end' }),
    ]);
    const board = processBoard({
      todo: [runningCard({ id: 'owner', plan })],
      processes: [boardProcess(plan)],
    });
    const change = delegateStep({
      board,
      cardId: 'owner',
      tokenId: ownerToken(board),
      newId: 'child',
      at: CHANGED_AT,
    });
    expect(
      change.ok && cardOf({ board: change.board, cardId: 'child' }).title,
    ).toBe(UNNAMED_STEP_TITLE);
  });

  it('repassa a recusa do motor para a etapa já delegada', () => {
    const board = ownerBoard();
    const tokenId = ownerToken(board);
    const first = delegateStep({
      board,
      cardId: 'owner',
      tokenId,
      newId: 'child',
      at: CHANGED_AT,
    });
    if (!first.ok) {
      throw new Error(first.message);
    }
    expect(
      delegateStep({
        board: first.board,
        cardId: 'owner',
        tokenId,
        newId: 'other',
        at: CHANGED_AT,
      }),
    ).toEqual({ ok: false, message: ALREADY_DELEGATED.message });
  });

  it('recusa a coluna bloqueada, que não recebe card', () => {
    const board = ownerBoard();
    const locked = {
      ...board,
      lanes: board.lanes.map((lane) =>
        lane.id === 'doing' ? { ...lane, locked: true } : lane,
      ),
    };
    const change = delegateStep({
      board: locked,
      cardId: 'owner',
      tokenId: ownerToken(board),
      newId: 'child',
      at: CHANGED_AT,
    });
    expect(change).toEqual({
      ok: false,
      message:
        'A coluna Em andamento está bloqueada: libere a coluna para criar o card filho.',
    });
  });

  it('recusa o card que não está no quadro', () => {
    expect(
      delegateStep({
        board: ownerBoard(),
        cardId: 'x',
        tokenId: 'token-1',
        newId: 'child',
        at: CHANGED_AT,
      }),
    ).toEqual({ ok: false, message: CARD_MISSING });
  });
});

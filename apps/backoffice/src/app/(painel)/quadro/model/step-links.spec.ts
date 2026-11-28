import { act, tokenAt } from '@/shared/process/engine-test-kit';
import { linearPlan } from '@/shared/process/engine-test-plans';

import {
  boardProcess,
  cardOf,
  delegatedPair,
  processBoard,
  runOf,
} from './process-test-data';
import { syncStepLinks } from './step-links';

const pair = delegatedPair({
  ownerId: 'owner',
  childId: 'child',
  stepRef: 'a',
});

describe('syncStepLinks', () => {
  it('devolve o próprio quadro quando as duas pontas da ligação fecham', () => {
    const board = processBoard({
      todo: [pair.owner, pair.child],
      processes: [boardProcess()],
    });
    expect(syncStepLinks(board)).toBe(board);
  });

  it('tira a ligação do filho quando a ficha já saiu da etapa', () => {
    const moved = act({
      plan: linearPlan,
      run: runOf(pair.owner),
      action: { kind: 'complete', tokenId: pair.tokenId },
    });
    const board = processBoard({
      todo: [{ ...pair.owner, process: moved }, pair.child],
      processes: [boardProcess()],
    });
    const next = syncStepLinks(board);
    expect(cardOf({ board: next, cardId: 'child' }).stepOf).toBeUndefined();
    expect(cardOf({ board: next, cardId: 'owner' }).process).toBe(moved);
  });

  it('tira a ligação do filho quando o processo do dono não está em andamento', () => {
    const cancelled = act({
      plan: linearPlan,
      run: runOf(pair.owner),
      action: { kind: 'cancel' },
    });
    const board = processBoard({
      todo: [{ ...pair.owner, process: cancelled }, pair.child],
      processes: [boardProcess()],
    });
    expect(
      cardOf({ board: syncStepLinks(board), cardId: 'child' }).stepOf,
    ).toBeUndefined();
  });

  it('devolve a etapa ao dono quando o filho saiu das colunas', () => {
    const board = processBoard({
      todo: [pair.owner],
      processes: [boardProcess()],
    });
    const run = runOf(cardOf({ board: syncStepLinks(board), cardId: 'owner' }));
    expect(tokenAt({ run, stepRef: 'a' }).delegateId).toBeUndefined();
  });

  it('devolve a etapa ao dono quando o filho aponta para outra ficha', () => {
    const board = processBoard({
      todo: [
        pair.owner,
        { ...pair.child, stepOf: { cardId: 'owner', tokenId: 'token-9' } },
      ],
      processes: [boardProcess()],
    });
    const next = syncStepLinks(board);
    const run = runOf(cardOf({ board: next, cardId: 'owner' }));
    expect(tokenAt({ run, stepRef: 'a' }).delegateId).toBeUndefined();
    expect(cardOf({ board: next, cardId: 'child' }).stepOf).toBeUndefined();
  });

  it('mantém a execução do dono sem roteiro, que não tem como andar', () => {
    const board = processBoard({ todo: [pair.owner] });
    expect(syncStepLinks(board)).toBe(board);
  });
});

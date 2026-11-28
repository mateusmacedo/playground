import { INVALID_PLAN, UNKNOWN_TOKEN } from '@/shared/process/engine-result';
import { act, tokenAt } from '@/shared/process/engine-test-kit';
import { linearPlan } from '@/shared/process/engine-test-plans';

import {
  ALREADY_RUNNING,
  advanceProcess,
  CARD_MISSING,
  cardRunOf,
  NO_PROCESS,
  PLAN_MISSING,
  removeProcess,
  startProcess,
} from './process-run';
import {
  boardProcess,
  CHANGED_AT,
  cardOf,
  processBoard,
  runningCard,
  runOf,
} from './process-test-data';

const process = boardProcess();

describe('startProcess', () => {
  it('inicia a execução no card e guarda o roteiro no quadro', () => {
    const board = processBoard({ todo: [{ id: 'a', title: 'A' }] });
    const change = startProcess({
      board,
      cardId: 'a',
      process,
      at: CHANGED_AT,
      by: 'Ana',
    });
    if (!change.ok) {
      throw new Error(change.message);
    }
    const run = cardOf({ board: change.board, cardId: 'a' }).process;
    expect(run?.status).toBe('running');
    expect(run?.startedAt).toBe(CHANGED_AT);
    expect(run?.log[0]?.by).toBe('Ana');
    expect(change.board.processes).toEqual([process]);
  });

  it('não repete o roteiro que o quadro já tem', () => {
    const board = processBoard({
      todo: [{ id: 'a', title: 'A' }],
      processes: [process],
    });
    const change = startProcess({
      board,
      cardId: 'a',
      process,
      at: CHANGED_AT,
    });
    expect(change.ok && change.board.processes).toEqual([process]);
  });

  it('troca a execução encerrada por uma nova', () => {
    const card = runningCard({ id: 'a' });
    const ended = { ...runOf(card), status: 'cancelled' as const };
    const board = processBoard({
      todo: [{ ...card, process: ended }],
      processes: [process],
    });
    const change = startProcess({
      board,
      cardId: 'a',
      process,
      at: CHANGED_AT,
    });
    expect(
      change.ok && cardOf({ board: change.board, cardId: 'a' }).process?.status,
    ).toBe('running');
  });

  it('recusa o card que já tem execução em andamento', () => {
    const board = processBoard({
      todo: [runningCard({ id: 'a' })],
      processes: [process],
    });
    expect(
      startProcess({ board, cardId: 'a', process, at: CHANGED_AT }),
    ).toEqual({ ok: false, message: ALREADY_RUNNING });
  });

  it('recusa o card que não está no quadro', () => {
    expect(
      startProcess({
        board: processBoard(),
        cardId: 'x',
        process,
        at: CHANGED_AT,
      }),
    ).toEqual({ ok: false, message: CARD_MISSING });
  });

  it('repassa a recusa do motor para o roteiro que não dá para executar', () => {
    const board = processBoard({ todo: [{ id: 'a', title: 'A' }] });
    const broken = { ...process, plan: { startId: 'missing', steps: [] } };
    expect(
      startProcess({ board, cardId: 'a', process: broken, at: CHANGED_AT }),
    ).toEqual({ ok: false, message: INVALID_PLAN.message });
  });
});

describe('cardRunOf', () => {
  it('encontra o card, a coluna, a execução e o roteiro', () => {
    const board = processBoard({
      doing: [runningCard({ id: 'a' })],
      processes: [process],
    });
    const found = cardRunOf({ board, cardId: 'a' });
    expect(found.ok && found.lane.id).toBe('doing');
    expect(found.ok && found.plan).toBe(linearPlan);
  });

  it('explica por que não dá para agir no card', () => {
    const board = processBoard({
      todo: [{ id: 'a', title: 'A' }, runningCard({ id: 'b' })],
    });
    expect(cardRunOf({ board, cardId: 'x' })).toEqual({
      ok: false,
      message: CARD_MISSING,
    });
    expect(cardRunOf({ board, cardId: 'a' })).toEqual({
      ok: false,
      message: NO_PROCESS,
    });
    expect(cardRunOf({ board, cardId: 'b' })).toEqual({
      ok: false,
      message: PLAN_MISSING,
    });
  });
});

describe('advanceProcess', () => {
  const card = runningCard({ id: 'a' });
  const tokenId = tokenAt({ run: runOf(card), stepRef: 'a' }).id;
  const board = processBoard({ todo: [card], processes: [process] });

  it('aplica a ação do motor à execução do card', () => {
    const change = advanceProcess({
      board,
      cardId: 'a',
      action: { kind: 'complete', tokenId },
      at: CHANGED_AT,
      by: 'Ana',
    });
    if (!change.ok) {
      throw new Error(change.message);
    }
    const run = runOf(cardOf({ board: change.board, cardId: 'a' }));
    expect(tokenAt({ run, stepRef: 'b' })).toBeDefined();
    expect(run.log.at(-1)?.by).toBe('Ana');
  });

  it('repassa a recusa do motor', () => {
    expect(
      advanceProcess({
        board,
        cardId: 'a',
        action: { kind: 'complete', tokenId: 'token-99' },
        at: CHANGED_AT,
      }),
    ).toEqual({ ok: false, message: UNKNOWN_TOKEN.message });
  });

  it('recusa o card sem processo', () => {
    expect(
      advanceProcess({
        board: processBoard({ todo: [{ id: 'a', title: 'A' }] }),
        cardId: 'a',
        action: { kind: 'cancel' },
        at: CHANGED_AT,
      }),
    ).toEqual({ ok: false, message: NO_PROCESS });
  });

  it('devolve o mesmo quadro quando a ação não muda a execução', () => {
    const change = advanceProcess({
      board,
      cardId: 'a',
      action: { kind: 'undelegate', tokenId },
      at: CHANGED_AT,
    });
    expect(change.ok && change.board).toBe(board);
  });
});

describe('removeProcess', () => {
  it('tira do card a execução encerrada', () => {
    const card = runningCard({ id: 'a' });
    const cancelled = act({
      plan: linearPlan,
      run: runOf(card),
      action: { kind: 'cancel' },
    });
    const board = processBoard({
      todo: [{ ...card, process: cancelled }],
      processes: [process],
    });
    const next = removeProcess({ board, cardId: 'a' });
    expect(cardOf({ board: next, cardId: 'a' }).process).toBeUndefined();
  });

  it('tira a execução que ficou sem roteiro', () => {
    const board = processBoard({ todo: [runningCard({ id: 'a' })] });
    const next = removeProcess({ board, cardId: 'a' });
    expect(cardOf({ board: next, cardId: 'a' }).process).toBeUndefined();
  });

  it('mantém a execução em andamento e o card sem processo', () => {
    const board = processBoard({
      todo: [runningCard({ id: 'a' }), { id: 'b', title: 'B' }],
      processes: [process],
    });
    expect(removeProcess({ board, cardId: 'a' })).toBe(board);
    expect(removeProcess({ board, cardId: 'b' })).toBe(board);
  });
});

import {
  act,
  branching,
  end,
  planOf,
  step,
  tokenAt,
} from '@/shared/process/engine-test-kit';
import { reviewFields } from '@/shared/process/engine-test-plans';
import type { ProcessPlan } from '@/shared/process/plan';

import type { Board, BoardCard, BoardRules } from './board';
import { moveToDone } from './done-lane';
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
import { settleBoard } from './reactions';

/** Roteiro de uma etapa só: start > a > end. */
const shortPlan: ProcessPlan = planOf([
  step({ id: 'start', kind: 'start', to: 'a' }),
  step({ id: 'a', to: 'end' }),
  end({ id: 'end' }),
]);

interface ScenarioParams {
  readonly todo: readonly BoardCard[];
  readonly done?: readonly BoardCard[];
  readonly rules?: BoardRules;
  readonly plan?: ProcessPlan;
  /** Card que a mudança leva para a coluna de conclusão. */
  readonly moved: string;
}

/** O quadro depois de levar o card à coluna de conclusão e aplicar o que a mudança provoca. */
function settleMove(params: ScenarioParams): Board {
  const before = processBoard({
    todo: params.todo,
    done: params.done,
    rules: params.rules,
    processes: [boardProcess(params.plan)],
  });
  const after = moveToDone({ board: before, cardId: params.moved });
  return settleBoard({ before, after, at: CHANGED_AT });
}

describe('settleBoard', () => {
  it('conclui a etapa do dono quando o card filho chega à coluna de conclusão', () => {
    const pair = delegatedPair({
      ownerId: 'owner',
      childId: 'child',
      stepRef: 'a',
    });
    const board = settleMove({
      todo: [pair.owner, pair.child],
      moved: 'child',
    });
    const run = runOf(cardOf({ board, cardId: 'owner' }));
    expect(tokenAt({ run, stepRef: 'b' })).toBeDefined();
    expect(run.log.at(-1)?.note).toBe('Concluída pelo card filho Card child.');
    expect(cardOf({ board, cardId: 'child' }).stepOf).toBeUndefined();
  });

  it('deixa à espera a etapa com campo obrigatório', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'a' }),
      step({ id: 'a', to: 'end', data: { fields: reviewFields } }),
      end({ id: 'end' }),
    ]);
    const pair = delegatedPair({
      ownerId: 'owner',
      childId: 'child',
      stepRef: 'a',
      plan,
    });
    const board = settleMove({
      todo: [pair.owner, pair.child],
      plan,
      moved: 'child',
    });
    expect(cardOf({ board, cardId: 'owner' }).process).toBe(pair.owner.process);
    expect(cardOf({ board, cardId: 'child' }).stepOf).toEqual(
      pair.child.stepOf,
    );
  });

  it('deixa à espera a etapa que pede uma escolha', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'pick' }),
      branching({
        id: 'pick',
        kind: 'decision',
        branches: { yes: 'end', no: 'end' },
      }),
      end({ id: 'end' }),
    ]);
    const pair = delegatedPair({
      ownerId: 'owner',
      childId: 'child',
      stepRef: 'pick',
      plan,
    });
    const board = settleMove({
      todo: [pair.owner, pair.child],
      plan,
      moved: 'child',
    });
    expect(cardOf({ board, cardId: 'owner' }).process).toBe(pair.owner.process);
  });

  it('leva o dono à coluna de conclusão quando o filho conclui a última etapa e a regra está ligada', () => {
    const pair = delegatedPair({
      ownerId: 'owner',
      childId: 'child',
      stepRef: 'a',
      plan: shortPlan,
    });
    const board = settleMove({
      todo: [pair.owner, pair.child],
      plan: shortPlan,
      rules: { processEndMovesCard: true },
      moved: 'child',
    });
    expect(runOf(cardOf({ board, cardId: 'owner' })).status).toBe('completed');
    expect(laneCardIds({ board, laneId: DONE_LANE })).toEqual([
      'child',
      'owner',
    ]);
  });

  it('mantém o dono na coluna dele com a regra desligada', () => {
    const pair = delegatedPair({
      ownerId: 'owner',
      childId: 'child',
      stepRef: 'a',
      plan: shortPlan,
    });
    const board = settleMove({
      todo: [pair.owner, pair.child],
      plan: shortPlan,
      moved: 'child',
    });
    expect(runOf(cardOf({ board, cardId: 'owner' })).status).toBe('completed');
    expect(laneCardIds({ board, laneId: 'todo' })).toEqual(['owner']);
  });

  it('leva o card cujo processo acabou de ser concluído', () => {
    const card = runningCard({ id: 'a', plan: shortPlan });
    const run = runOf(card);
    const completed = act({
      plan: shortPlan,
      run,
      action: { kind: 'complete', tokenId: tokenAt({ run, stepRef: 'a' }).id },
    });
    const before = processBoard({
      todo: [card],
      rules: { processEndMovesCard: true },
      processes: [boardProcess(shortPlan)],
    });
    const after = {
      ...before,
      lanes: before.lanes.map((lane) => ({
        ...lane,
        cards: lane.cards.map((item) => ({ ...item, process: completed })),
      })),
    };
    const board = settleBoard({ before, after, at: CHANGED_AT });
    expect(laneCardIds({ board, laneId: DONE_LANE })).toEqual(['a']);
  });

  it('não leva de novo o card que já tinha o processo concluído', () => {
    const card = runningCard({ id: 'a', plan: shortPlan });
    const run = runOf(card);
    const completed = act({
      plan: shortPlan,
      run,
      action: { kind: 'complete', tokenId: tokenAt({ run, stepRef: 'a' }).id },
    });
    const before = processBoard({
      todo: [{ ...card, process: completed }],
      rules: { processEndMovesCard: true },
      processes: [boardProcess(shortPlan)],
    });
    const after = { ...before, nextNumber: before.nextNumber + 1 };
    expect(settleBoard({ before, after, at: CHANGED_AT })).toBe(after);
  });

  it('leva o pai junto com a última filha e sobe a hierarquia', () => {
    const board = settleMove({
      todo: [
        { id: 'g', title: 'Avô' },
        { id: 'p', title: 'Pai', parentId: 'g' },
        { id: 'c', title: 'Filha', parentId: 'p' },
      ],
      rules: { parentFollowsChildren: true },
      moved: 'c',
    });
    expect(laneCardIds({ board, laneId: DONE_LANE })).toEqual(['c', 'p', 'g']);
  });

  it('mantém o pai enquanto houver filha fora da coluna de conclusão', () => {
    const board = settleMove({
      todo: [
        { id: 'p', title: 'Pai' },
        { id: 'a', title: 'A', parentId: 'p' },
        { id: 'b', title: 'B', parentId: 'p' },
      ],
      rules: { parentFollowsChildren: true },
      moved: 'a',
    });
    expect(laneCardIds({ board, laneId: 'todo' })).toEqual(['p', 'b']);
  });

  it('não conclui etapa quando o dono perdeu a execução ou o roteiro', () => {
    const pair = delegatedPair({
      ownerId: 'owner',
      childId: 'child',
      stepRef: 'a',
    });
    const withoutRun = settleMove({
      todo: [{ ...pair.owner, process: undefined }, pair.child],
      moved: 'child',
    });
    expect(
      cardOf({ board: withoutRun, cardId: 'owner' }).process,
    ).toBeUndefined();
    const before = processBoard({ todo: [pair.owner, pair.child] });
    const after = moveToDone({ board: before, cardId: 'child' });
    const withoutPlan = settleBoard({ before, after, at: CHANGED_AT });
    expect(cardOf({ board: withoutPlan, cardId: 'owner' }).process).toBe(
      pair.owner.process,
    );
  });

  it('não leva o card criado já com o processo concluído', () => {
    const card = runningCard({ id: 'a', plan: shortPlan });
    const run = runOf(card);
    const completed = act({
      plan: shortPlan,
      run,
      action: { kind: 'complete', tokenId: tokenAt({ run, stepRef: 'a' }).id },
    });
    const before = processBoard({
      rules: { processEndMovesCard: true },
      processes: [boardProcess(shortPlan)],
    });
    const after = processBoard({
      todo: [{ ...card, process: completed }],
      rules: { processEndMovesCard: true },
      processes: [boardProcess(shortPlan)],
    });
    expect(
      laneCardIds({
        board: settleBoard({ before, after, at: CHANGED_AT }),
        laneId: 'todo',
      }),
    ).toEqual(['a']);
  });

  it('devolve o próprio quadro mudado quando a mudança não provoca nada', () => {
    const before = processBoard({ todo: [{ id: 'a', title: 'A' }] });
    const after = moveToDone({ board: before, cardId: 'a' });
    expect(settleBoard({ before, after, at: CHANGED_AT })).toBe(after);
  });
});

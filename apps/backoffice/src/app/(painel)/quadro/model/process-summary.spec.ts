import {
  ACTED_AT,
  end,
  planOf,
  STARTED_AT,
  step,
} from '@/shared/process/engine-test-kit';
import { parallelPlan } from '@/shared/process/engine-test-plans';
import type { ProcessPlan } from '@/shared/process/plan';

import { processSummary } from './process-summary';
import {
  boardProcess,
  cardOf,
  processBoard,
  runningCard,
} from './process-test-data';

/** start > a (prazo de 30 minutos) > end. */
const duePlan: ProcessPlan = planOf([
  step({ id: 'start', kind: 'start', to: 'a' }),
  step({
    id: 'a',
    to: 'end',
    data: { dueIn: { amount: 30, unit: 'minutes' } },
  }),
  end({ id: 'end' }),
]);

describe('processSummary', () => {
  it('resume o nome, a situação, o andamento e as etapas paradas', () => {
    const board = processBoard({
      todo: [runningCard({ id: 'a', plan: parallelPlan })],
      processes: [boardProcess(parallelPlan)],
    });
    const summary = processSummary({
      board,
      card: cardOf({ board, cardId: 'a' }),
    });
    expect(summary).toMatchObject({
      name: 'Processo',
      version: 1,
      status: 'running',
      overdue: false,
    });
    expect(summary?.steps.map((item) => item.active.step.id)).toEqual([
      'a',
      'b',
    ]);
    expect(summary?.progress.remaining).toBeGreaterThan(0);
  });

  it('marca a etapa que passou do prazo no instante da consulta', () => {
    const board = processBoard({
      todo: [runningCard({ id: 'a', plan: duePlan })],
      processes: [boardProcess(duePlan)],
    });
    const card = cardOf({ board, cardId: 'a' });
    const late = processSummary({ board, card, now: ACTED_AT });
    const early = processSummary({ board, card, now: STARTED_AT });
    expect(late?.overdue).toBe(true);
    expect(late?.steps[0]?.overdue).toBe(true);
    expect(early?.overdue).toBe(false);
    expect(processSummary({ board, card })?.overdue).toBe(false);
  });

  it('não resume o card sem processo ou sem o roteiro dele', () => {
    const board = processBoard({
      todo: [{ id: 'a', title: 'A' }, runningCard({ id: 'b' })],
    });
    expect(
      processSummary({ board, card: cardOf({ board, cardId: 'a' }) }),
    ).toBeUndefined();
    expect(
      processSummary({ board, card: cardOf({ board, cardId: 'b' }) }),
    ).toBeUndefined();
  });
});

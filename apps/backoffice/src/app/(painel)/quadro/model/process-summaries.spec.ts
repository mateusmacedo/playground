import { ACTED_AT, planOf, step } from '@/shared/process/engine-test-kit';

import { hasRunningProcess, processSummaries } from './process-summaries';
import { boardProcess, processBoard, runningCard } from './process-test-data';

/** Roteiro de uma tarefa com prazo de meia hora, contada da chegada da execução a ela. */
const timedPlan = planOf([
  step({ id: 'start', kind: 'start', to: 'a' }),
  step({ id: 'a', data: { dueIn: { amount: 30, unit: 'minutes' } } }),
]);

describe('processSummaries', () => {
  it('resume o processo de cada card que tem um, pelo id do card', () => {
    const board = processBoard({
      todo: [runningCard({ id: 'c1' }), { id: 'c2', title: 'Sem processo' }],
      doing: [runningCard({ id: 'c3' })],
      processes: [boardProcess()],
    });

    const summaries = processSummaries({ board });

    expect([...summaries.keys()]).toEqual(['c1', 'c3']);
    expect(summaries.get('c1')).toMatchObject({
      name: 'Processo',
      status: 'running',
      progress: { done: 0, total: 2 },
      overdue: false,
    });
  });

  it('deixa de fora o card cujo roteiro o quadro não tem', () => {
    const board = processBoard({ todo: [runningCard({ id: 'c1' })] });

    expect(processSummaries({ board }).size).toBe(0);
  });

  it('marca como atrasado o processo com etapa fora do prazo no instante da consulta', () => {
    const board = processBoard({
      todo: [runningCard({ id: 'c1', plan: timedPlan })],
      processes: [boardProcess(timedPlan)],
    });

    const late = processSummaries({ board, now: ACTED_AT });
    const untimed = processSummaries({ board });

    expect(late.get('c1')?.overdue).toBe(true);
    expect(untimed.get('c1')?.overdue).toBe(false);
  });
});

describe('hasRunningProcess', () => {
  it('é verdadeiro quando algum card das colunas tem processo em andamento', () => {
    const board = processBoard({
      doing: [runningCard({ id: 'c1' })],
      processes: [boardProcess()],
    });

    expect(hasRunningProcess(board)).toBe(true);
  });

  it('é falso sem processo, e com o processo já encerrado', () => {
    const running = runningCard({ id: 'c1' });
    const ended = {
      ...running,
      process: running.process && {
        ...running.process,
        status: 'cancelled' as const,
        tokens: [],
      },
    };

    expect(hasRunningProcess(processBoard({ todo: [ended] }))).toBe(false);
    expect(hasRunningProcess(processBoard())).toBe(false);
  });
});

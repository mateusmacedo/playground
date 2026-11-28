import { linearPlan, parallelPlan } from '@/shared/process/engine-test-plans';

import {
  keepProcess,
  planFor,
  processKey,
  pruneProcesses,
  sameRun,
} from './board-processes';
import {
  boardProcess,
  processBoard,
  runningCard,
  runOf,
} from './process-test-data';

const process = boardProcess();
const newer = { ...boardProcess(parallelPlan), version: 2 };

describe('planFor', () => {
  it('encontra o roteiro pela definição e pela versão da execução', () => {
    const board = processBoard({ processes: [process, newer] });
    expect(processKey(newer)).toBe('process-1:2');
    expect(planFor({ board, run: newer })).toBe(parallelPlan);
    expect(planFor({ board, run: { ...newer, version: 3 } })).toBeUndefined();
    expect(planFor({ board: processBoard(), run: process })).toBeUndefined();
  });
});

describe('keepProcess', () => {
  it('guarda a versão nova e mantém a que o quadro já tem', () => {
    const board = processBoard({ processes: [process] });
    expect(keepProcess({ board, process: { ...process, name: 'Outro' } })).toBe(
      board,
    );
    expect(keepProcess({ board, process: newer }).processes).toEqual([
      process,
      newer,
    ]);
  });
});

describe('sameRun', () => {
  it('reconhece a mesma execução em momentos diferentes', () => {
    const run = runOf(runningCard({ id: 'a' }));
    expect(sameRun(run, { ...run, status: 'cancelled' })).toBe(true);
    expect(
      sameRun(run, { ...run, startedAt: '2026-11-27T10:00:00.000Z' }),
    ).toBe(false);
    expect(sameRun(run, undefined)).toBe(false);
    expect(sameRun(undefined, run)).toBe(false);
  });
});

describe('pruneProcesses', () => {
  it('tira o roteiro que nenhum card usa, contando os arquivados', () => {
    const archived = runningCard({ id: 'b', plan: linearPlan });
    const board = {
      ...processBoard({
        todo: [{ id: 'a', title: 'A' }],
        processes: [process, newer],
      }),
      archive: [
        {
          id: 'arq',
          archivedAt: '2026-11-26T09:00:00.000Z',
          cards: [{ laneId: 'todo', card: archived }],
        },
      ],
    };
    expect(pruneProcesses(board).processes).toEqual([process]);
  });

  it('tira a lista quando nenhum roteiro sobra', () => {
    const board = processBoard({ processes: [process] });
    expect(pruneProcesses(board).processes).toBeUndefined();
  });

  it('devolve o próprio quadro quando todos os roteiros estão em uso ou não há nenhum', () => {
    const used = processBoard({
      todo: [runningCard({ id: 'a' })],
      processes: [process],
    });
    const empty = processBoard();
    expect(pruneProcesses(used)).toBe(used);
    expect(pruneProcesses(empty)).toBe(empty);
  });
});

import { tokenAt } from '@/shared/process/engine-test-kit';

import type { Board } from './board';
import { withConsistentProcesses } from './process-consistency';
import {
  boardProcess,
  cardOf,
  delegatedPair,
  processBoard,
  runningCard,
  runOf,
} from './process-test-data';
import { parseStoredBoard, serializeBoard } from './storage';

const process = boardProcess();

describe('withConsistentProcesses', () => {
  it('devolve o próprio quadro quando processos e dependências fecham', () => {
    const board = processBoard({
      todo: [
        runningCard({ id: 'a' }),
        { id: 'b', title: 'B', blockedBy: ['a'] },
      ],
      processes: [process],
    });
    expect(withConsistentProcesses(board)).toBe(board);
  });

  it('tira a execução cujo roteiro o quadro não tem, também no arquivo', () => {
    const board: Board = {
      ...processBoard({ todo: [runningCard({ id: 'a' })] }),
      archive: [
        {
          id: 'arq',
          archivedAt: '2026-11-26T09:00:00.000Z',
          cards: [{ laneId: 'todo', card: runningCard({ id: 'b' }) }],
        },
      ],
    };
    const next = withConsistentProcesses(board);
    expect(cardOf({ board: next, cardId: 'a' }).process).toBeUndefined();
    expect(next.archive[0]?.cards[0]?.card.process).toBeUndefined();
  });

  it('tira o bloqueador que não está nas colunas e o próprio card', () => {
    const board = processBoard({
      todo: [
        { id: 'a', title: 'A', blockedBy: ['a', 'x', 'b'] },
        { id: 'b', title: 'B', blockedBy: ['a', 'x'] },
        { id: 'c', title: 'C', blockedBy: ['x'] },
      ],
    });
    const next = withConsistentProcesses(board);
    expect(cardOf({ board: next, cardId: 'a' }).blockedBy).toEqual(['b']);
    expect(cardOf({ board: next, cardId: 'b' }).blockedBy).toEqual(['a']);
    expect(cardOf({ board: next, cardId: 'c' }).blockedBy).toBeUndefined();
  });

  it('desfaz a ligação de etapa que não fecha dos dois lados e poda o roteiro sem uso', () => {
    const pair = delegatedPair({
      ownerId: 'owner',
      childId: 'child',
      stepRef: 'a',
    });
    const board = processBoard({
      todo: [pair.owner],
      processes: [process, { ...process, version: 2 }],
    });
    const next = withConsistentProcesses(board);
    const run = runOf(cardOf({ board: next, cardId: 'owner' }));
    expect(tokenAt({ run, stepRef: 'a' }).delegateId).toBeUndefined();
    expect(next.processes).toEqual([process]);
  });
});

describe('quadro gravado com processos', () => {
  it('volta igual depois de gravado e lido', () => {
    const pair = delegatedPair({
      ownerId: 'owner',
      childId: 'child',
      stepRef: 'a',
    });
    const board = processBoard({
      todo: [pair.owner, { ...pair.child, blockedBy: ['owner'] }],
      rules: { doneWaitsProcess: true, childInherits: true },
      processes: [process],
    });
    const read = parseStoredBoard(serializeBoard(board));
    expect(read?.processes).toEqual([process]);
    expect(read?.config.rules).toEqual({
      doneWaitsProcess: true,
      childInherits: true,
    });
    expect(read && cardOf({ board: read, cardId: 'owner' }).process).toEqual(
      pair.owner.process,
    );
    expect(read && cardOf({ board: read, cardId: 'child' })).toMatchObject({
      stepOf: pair.child.stepOf,
      blockedBy: ['owner'],
    });
  });

  it('abre o quadro gravado antes dos processos existirem', () => {
    const raw = JSON.stringify({
      version: 3,
      board: {
        lanes: [
          {
            id: 'todo',
            title: 'A fazer',
            cards: [{ id: 'a', title: 'A', number: 1 }],
          },
        ],
        labels: [],
        archive: [],
        nextNumber: 2,
        config: { keyPrefix: 'QD' },
      },
    });
    const read = parseStoredBoard(raw);
    expect(read?.processes).toBeUndefined();
    expect(read?.config.rules).toBeUndefined();
    expect(
      read && cardOf({ board: read, cardId: 'a' }).process,
    ).toBeUndefined();
  });

  it('descarta na leitura a execução que perdeu o roteiro', () => {
    const board = processBoard({
      todo: [runningCard({ id: 'a' })],
      processes: [process],
    });
    const raw = serializeBoard({ ...board, processes: undefined });
    const read = parseStoredBoard(raw);
    expect(
      read && cardOf({ board: read, cardId: 'a' }).process,
    ).toBeUndefined();
  });
});

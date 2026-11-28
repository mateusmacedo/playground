import type { Board } from '../model/board';
import {
  boardProcess,
  cardOf,
  processBoard,
  runningCard,
} from '../model/process-test-data';
import type { BoardChange, CommandContext } from './command-context';
import { processCommands } from './process-commands';

const process = boardProcess();

describe('processCommands', () => {
  it('refaz a mudança sobre o quadro do momento e não aplica o que ele já não aceita', () => {
    const shown = processBoard({ todo: [{ id: 'a', title: 'A' }] });
    const changes: BoardChange[] = [];
    const context: CommandContext = {
      board: shown,
      commit: (change) => changes.push(change),
      commitLanes: vi.fn(),
      refuse: vi.fn(),
    };
    const refusal = processCommands(context).startProcess({
      cardId: 'a',
      process,
    });
    expect(refusal).toBeUndefined();

    const current: Board = processBoard({
      todo: [runningCard({ id: 'a' })],
      processes: [process],
    });
    expect(changes[0]?.update(current)).toBe(current);
    expect(changes[0]?.update(shown).processes).toEqual([process]);
  });

  it('registra na trilha da execução quem entregou a etapa ao card filho', () => {
    const shown = processBoard({
      todo: [runningCard({ id: 'a' })],
      processes: [process],
    });
    const changes: BoardChange[] = [];
    const context: CommandContext = {
      board: shown,
      commit: (change) => changes.push(change),
      commitLanes: vi.fn(),
      refuse: vi.fn(),
    };
    const tokenId = cardOf({ board: shown, cardId: 'a' }).process?.tokens[0]
      ?.id as string;

    const childId = processCommands(context).delegateStep({
      cardId: 'a',
      tokenId,
      by: 'Ana',
    });

    const after = changes[0]?.update(shown) as Board;
    const owner = cardOf({ board: after, cardId: 'a' });
    expect(childId).toBeDefined();
    expect(owner.process?.log.at(-1)).toMatchObject({
      kind: 'delegated',
      by: 'Ana',
    });
  });
});

import { processBoard } from '../model/process-test-data';
import type { BoardChange, CommandContext } from './command-context';
import { linkCommands } from './link-commands';

function contextFor(params: { readonly changes: BoardChange[] }) {
  const shown = processBoard({
    todo: [
      {
        id: 'a',
        title: 'A',
        checklist: [{ id: 'item-1', text: 'Fazer', done: false }],
      },
    ],
  });
  const context: CommandContext = {
    board: shown,
    commit: (change) => params.changes.push(change),
    commitLanes: vi.fn(),
    refuse: vi.fn(),
  };
  return { shown, context };
}

describe('linkCommands', () => {
  it('refaz a conversão e a cópia sobre o quadro do momento e não aplica o que ele já não aceita', () => {
    const changes: BoardChange[] = [];
    const { shown, context } = contextFor({ changes });
    const commands = linkCommands(context);
    expect(
      commands.convertChecklistItem({ cardId: 'a', itemId: 'item-1' }),
    ).toBe('card-1');
    expect(commands.duplicateCardTree('a')).toBe('card-1');

    const current = processBoard();
    expect(changes[0]?.update(current)).toBe(current);
    expect(changes[1]?.update(current)).toBe(current);
    expect(changes[1]?.update(shown).nextNumber).toBe(shown.nextNumber + 1);
  });
});

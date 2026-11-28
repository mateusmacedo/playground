import type { BoardCommands } from '../board-commands';
import { duplicateCardTree } from '../model/card-tree-copy';
import { convertChecklistItem } from '../model/checklist-convert';
import { addBlocker, removeBlocker } from '../model/dependencies';
import { attemptChange } from './attempt-change';
import { nextCardId } from './card-commands';
import type { CommandContext } from './command-context';

export type LinkCommands = Pick<
  BoardCommands,
  'addBlocker' | 'removeBlocker' | 'convertChecklistItem' | 'duplicateCardTree'
>;

/** Comandos que ligam cards: dependência entre eles, item de checklist que vira filho e cópia do card com os filhos. */
export function linkCommands(context: CommandContext): LinkCommands {
  const { board, commit, refuse } = context;

  return {
    addBlocker: (change) =>
      attemptChange({
        context,
        change: (current) => addBlocker({ board: current, ...change }),
      }),
    removeBlocker: (change) =>
      commit({
        update: (current) => removeBlocker({ board: current, ...change }),
      }),
    convertChecklistItem: (change) => {
      const newId = nextCardId(board);
      const at = new Date().toISOString();
      const refusal = attemptChange({
        context,
        change: (current) =>
          convertChecklistItem({ board: current, ...change, newId, at }),
      });
      if (refusal !== undefined) {
        refuse(refusal);
        return undefined;
      }
      return newId;
    },
    duplicateCardTree: (cardId) => {
      const at = new Date().toISOString();
      const preview = duplicateCardTree({ board, cardId, at });
      if (!preview.ok) {
        refuse(preview.message);
        return undefined;
      }
      commit({
        update: (current) => {
          const result = duplicateCardTree({ board: current, cardId, at });
          return result.ok ? result.board : current;
        },
      });
      return preview.copyId;
    },
  };
}

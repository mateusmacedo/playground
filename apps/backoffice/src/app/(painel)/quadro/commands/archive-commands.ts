import type { BoardCommands } from '../board-commands';
import { archiveCard, deleteArchived, restoreArchived } from '../model/archive';
import type { CommandContext } from './command-context';

export type ArchiveCommands = Pick<
  BoardCommands,
  'archiveCard' | 'restoreArchived' | 'deleteArchived'
>;

/** Comandos do arquivo: arquivar o card com os descendentes, restaurar e excluir de vez. */
export function archiveCommands(context: CommandContext): ArchiveCommands {
  const { commit } = context;

  return {
    archiveCard: (cardId) => {
      const at = new Date().toISOString();
      commit({
        update: (current) => archiveCard({ board: current, cardId, at }),
      });
    },
    restoreArchived: (entryId) =>
      commit({
        update: (current) => restoreArchived({ board: current, entryId }),
      }),
    deleteArchived: (entryId) =>
      commit({
        update: (current) => deleteArchived({ board: current, entryId }),
      }),
  };
}

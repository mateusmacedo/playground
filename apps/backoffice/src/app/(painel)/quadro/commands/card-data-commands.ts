import type { BoardCommands } from '../board-commands';
import { addAttachment, removeAttachment } from '../model/attachments';
import {
  addChecklistItem,
  removeChecklistItem,
  toggleChecklistItem,
} from '../model/checklist';
import { addComment, removeComment } from '../model/comments';
import { setDueDate, setDueDone } from '../model/due';
import { setAssignee } from '../model/people';
import type { CommandContext } from './command-context';

export type CardDataCommands = Pick<
  BoardCommands,
  | 'setAssignee'
  | 'setDueDate'
  | 'setDueDone'
  | 'addChecklistItem'
  | 'toggleChecklistItem'
  | 'removeChecklistItem'
  | 'addComment'
  | 'removeComment'
  | 'addAttachment'
  | 'removeAttachment'
>;

/** Comandos dos dados do card: responsável, prazo, checklist, comentários e anexos. */
export function cardDataCommands(context: CommandContext): CardDataCommands {
  const { commit, commitLanes } = context;

  return {
    setAssignee: (change) =>
      commit({
        update: (current) => setAssignee({ board: current, ...change }),
      }),
    setDueDate: (change) =>
      commitLanes({ update: (lanes) => setDueDate({ lanes, ...change }) }),
    setDueDone: (change) =>
      commitLanes({ update: (lanes) => setDueDone({ lanes, ...change }) }),
    addChecklistItem: (change) =>
      commitLanes({
        update: (lanes) => addChecklistItem({ lanes, ...change }),
      }),
    toggleChecklistItem: (change) =>
      commitLanes({
        update: (lanes) => toggleChecklistItem({ lanes, ...change }),
      }),
    removeChecklistItem: (change) =>
      commitLanes({
        update: (lanes) => removeChecklistItem({ lanes, ...change }),
      }),
    addComment: (change) => {
      const comment = {
        author: change.author,
        text: change.text,
        at: new Date().toISOString(),
      };
      commitLanes({
        update: (lanes) =>
          addComment({ lanes, cardId: change.cardId, comment }),
      });
    },
    removeComment: (change) =>
      commitLanes({ update: (lanes) => removeComment({ lanes, ...change }) }),
    addAttachment: (change) => {
      const attachment = {
        ...change.attachment,
        at: new Date().toISOString(),
      };
      commitLanes({
        update: (lanes) =>
          addAttachment({ lanes, cardId: change.cardId, attachment }),
      });
    },
    removeAttachment: (change) =>
      commitLanes({
        update: (lanes) => removeAttachment({ lanes, ...change }),
      }),
  };
}

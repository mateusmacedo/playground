import type { BoardCommands, UpdateCardChange } from '../board-commands';
import { allCards, type Board } from '../model/board';
import { archivedCards } from '../model/board-state';
import {
  addCard,
  duplicateCard,
  moveCardToLane,
  removeCard,
  updateCard,
} from '../model/cards';
import { inheritedFromParent } from '../model/child-inherit';
import { setParent } from '../model/hierarchy';
import { nextId } from '../model/ids';
import type { CommandContext } from './command-context';

export type CardCommands = Pick<
  BoardCommands,
  | 'addCard'
  | 'updateCard'
  | 'moveCardToLane'
  | 'setParent'
  | 'removeCard'
  | 'duplicateCard'
>;

/** Id do próximo card; conta também os arquivados, para um card restaurado não colidir com um novo. */
export function nextCardId(board: Board): string {
  const live = allCards(board.lanes);
  const archived = archivedCards(board);
  const taken = [...live, ...archived].map((card) => card.id);
  return nextId({ prefix: 'card', taken });
}

/** Chave que junta a digitação seguida no mesmo campo num passo só do desfazer. */
function editKey(change: UpdateCardChange): string | undefined {
  if (change.patch.title !== undefined) {
    return `title:${change.cardId}`;
  }
  if (change.patch.description !== undefined) {
    return `description:${change.cardId}`;
  }
  return undefined;
}

/** Comandos do card no quadro: criar, editar o texto, mudar de coluna ou de pai, excluir e duplicar. */
export function cardCommands(context: CommandContext): CardCommands {
  const { board, commit, commitLanes } = context;

  return {
    addCard: (card) => {
      if (!card.title.trim()) {
        return undefined;
      }
      const id = nextCardId(board);
      commit({
        update: (current) => {
          const lanes = addCard({
            lanes: current.lanes,
            laneId: card.laneId,
            card: {
              id,
              title: card.title,
              parentId: card.parentId,
              number: current.nextNumber,
              ...inheritedFromParent({
                board: current,
                parentId: card.parentId,
              }),
            },
          });
          if (lanes === current.lanes) {
            return current;
          }
          return { ...current, lanes, nextNumber: current.nextNumber + 1 };
        },
      });
      return id;
    },
    updateCard: (change) =>
      commitLanes({
        update: (lanes) => updateCard({ lanes, ...change }),
        key: editKey(change),
      }),
    moveCardToLane: (change) =>
      commitLanes({ update: (lanes) => moveCardToLane({ lanes, ...change }) }),
    setParent: (change) =>
      commitLanes({ update: (lanes) => setParent({ lanes, ...change }) }),
    removeCard: (cardId) =>
      commitLanes({ update: (lanes) => removeCard({ lanes, cardId }) }),
    duplicateCard: (cardId) => {
      const newId = nextCardId(board);
      const at = new Date().toISOString();
      commit({
        update: (current) =>
          duplicateCard({ board: current, cardId, newId, at }),
      });
      return newId;
    },
  };
}

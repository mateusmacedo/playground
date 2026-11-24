import type { BoardLane } from './model/board';
import {
  addCard,
  type CardPatch,
  moveCardToLane,
  removeCard,
  updateCard,
} from './model/cards';
import { setParent } from './model/hierarchy';
import { nextCardId, nextLaneId } from './model/ids';
import { addLane, removeLane, renameLane, setWipLimit } from './model/lanes';
import { useStoredBoard } from './use-stored-board';

/** O que as telas do quadro pedem; cada comando aplica a função pura correspondente ao quadro atual. */
export interface BoardCommands {
  /** Devolve o id da coluna criada, ou `undefined` quando o nome veio vazio. */
  readonly addLane: (title: string) => string | undefined;
  readonly renameLane: (change: {
    readonly laneId: string;
    readonly title: string;
  }) => void;
  readonly removeLane: (change: {
    readonly laneId: string;
    readonly moveCardsTo?: string;
  }) => void;
  readonly setWipLimit: (change: {
    readonly laneId: string;
    readonly limit: number | undefined;
  }) => void;
  /** Devolve o id do card criado, ou `undefined` quando o título veio vazio. */
  readonly addCard: (card: {
    readonly laneId: string;
    readonly title: string;
    readonly parentId?: string;
  }) => string | undefined;
  readonly updateCard: (change: {
    readonly cardId: string;
    readonly patch: CardPatch;
  }) => void;
  readonly moveCardToLane: (change: {
    readonly cardId: string;
    readonly laneId: string;
  }) => void;
  readonly setParent: (change: {
    readonly cardId: string;
    readonly parentId: string | undefined;
  }) => void;
  readonly removeCard: (cardId: string) => void;
  /** Volta ao quadro inicial. */
  readonly reset: () => void;
}

export interface BoardState {
  readonly lanes: readonly BoardLane[];
  readonly setLanes: (lanes: readonly BoardLane[]) => void;
  readonly commands: BoardCommands;
}

/** Estado do quadro e os comandos de edição, com a gravação no navegador quando há `storageKey`. */
export function useBoard(params: {
  readonly initial: readonly BoardLane[];
  readonly storageKey?: string;
}): BoardState {
  const [lanes, setLanes] = useStoredBoard(params);

  function apply(next: readonly BoardLane[]): boolean {
    if (next === lanes) {
      return false;
    }
    setLanes(next);
    return true;
  }

  const commands: BoardCommands = {
    addLane: (title) => {
      const id = nextLaneId(lanes);
      return apply(addLane({ lanes, lane: { id, title } })) ? id : undefined;
    },
    renameLane: (change) => {
      apply(renameLane({ lanes, ...change }));
    },
    removeLane: (change) => {
      apply(removeLane({ lanes, ...change }));
    },
    setWipLimit: (change) => {
      apply(setWipLimit({ lanes, ...change }));
    },
    addCard: ({ laneId, title, parentId }) => {
      const id = nextCardId(lanes);
      return apply(addCard({ lanes, laneId, card: { id, title, parentId } }))
        ? id
        : undefined;
    },
    updateCard: (change) => {
      apply(updateCard({ lanes, ...change }));
    },
    moveCardToLane: (change) => {
      apply(moveCardToLane({ lanes, ...change }));
    },
    setParent: (change) => {
      apply(setParent({ lanes, ...change }));
    },
    removeCard: (cardId) => {
      apply(removeCard({ lanes, cardId }));
    },
    reset: () => {
      apply(params.initial);
    },
  };

  return { lanes, setLanes, commands };
}

import {
  type Board,
  type BoardCard,
  type BoardLane,
  findCard,
  moveCard,
} from './board';
import { cardKey } from './card-key';

export type CardPatch = Partial<Pick<BoardCard, 'title' | 'description'>>;

/** Dados do card que entra no quadro. */
export interface NewCardData {
  readonly id: string;
  readonly title: string;
  readonly parentId?: string;
  readonly number?: number;
}

export interface AddCardParams {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly card: NewCardData;
}

/** Acrescenta o card no fim da coluna; título vazio ou coluna inexistente não criam nada. */
export function addCard(params: AddCardParams): readonly BoardLane[] {
  const { lanes, laneId, card } = params;
  const title = card.title.trim();
  if (!title || !lanes.some((lane) => lane.id === laneId)) {
    return lanes;
  }
  const created: BoardCard = {
    id: card.id,
    title,
    parentId: card.parentId,
    number: card.number,
  };
  return lanes.map((lane) =>
    lane.id === laneId ? { ...lane, cards: [...lane.cards, created] } : lane,
  );
}

export interface UpdateCardParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly patch: CardPatch;
}

/** Aplica a edição do card. Título vazio mantém o anterior, e descrição só com espaços some. */
export function updateCard(params: UpdateCardParams): readonly BoardLane[] {
  const { lanes, cardId, patch } = params;
  const location = findCard({ lanes, cardId });
  if (!location) {
    return lanes;
  }
  const { card } = location;
  const title = patch.title?.trim() || card.title;
  // NOTE: a descrição não é aparada, para não comer o espaço que a pessoa acabou de digitar; só a vazia some.
  const description =
    patch.description === undefined
      ? card.description
      : patch.description.trim()
        ? patch.description
        : undefined;
  if (title === card.title && description === card.description) {
    return lanes;
  }
  return lanes.map((lane) =>
    lane.id === location.lane.id
      ? {
          ...lane,
          cards: lane.cards.map((candidate) =>
            candidate.id === cardId
              ? { ...candidate, title, description }
              : candidate,
          ),
        }
      : lane,
  );
}

export interface MoveCardToLaneParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly laneId: string;
}

/** Leva o card para o fim de outra coluna; na própria coluna, não muda nada. */
export function moveCardToLane(
  params: MoveCardToLaneParams,
): readonly BoardLane[] {
  const { lanes, cardId, laneId } = params;
  const location = findCard({ lanes, cardId });
  if (!location || location.lane.id === laneId) {
    return lanes;
  }
  return moveCard({
    lanes,
    cardId,
    toLaneId: laneId,
    toIndex: Number.POSITIVE_INFINITY,
  });
}

export interface RemoveCardParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}

/** Exclui o card. Os filhos dele sobem um nível: passam para o pai do card excluído ou ficam sem pai. */
export function removeCard(params: RemoveCardParams): readonly BoardLane[] {
  const { lanes, cardId } = params;
  const location = findCard({ lanes, cardId });
  if (!location) {
    return lanes;
  }
  const grandparentId = location.card.parentId;
  return lanes.map((lane) => ({
    ...lane,
    cards: lane.cards
      .filter((card) => card.id !== cardId)
      .map((card) =>
        card.parentId === cardId ? { ...card, parentId: grandparentId } : card,
      ),
  }));
}

export interface DuplicateCardParams {
  readonly board: Board;
  readonly cardId: string;
  readonly newId: string;
  readonly at: string;
}

/**
 * Duplica o card logo abaixo do original, com o título marcado como cópia, os mesmos dados e o mesmo pai, mas sem os
 * filhos nem o histórico, que começa registrando de onde a cópia veio.
 */
export function duplicateCard(params: DuplicateCardParams): Board {
  const { board, cardId, newId, at } = params;
  const location = findCard({ lanes: board.lanes, cardId });
  if (!location) {
    return board;
  }
  const { card } = location;
  const copy: BoardCard = {
    ...card,
    id: newId,
    title: `${card.title} (cópia)`,
    number: board.nextNumber,
    activity: [
      {
        at,
        kind: 'duplicated',
        from: cardKey({ card, prefix: board.config.keyPrefix }),
      },
    ],
  };
  return {
    ...board,
    nextNumber: board.nextNumber + 1,
    lanes: board.lanes.map((lane, index) =>
      index === location.laneIndex
        ? {
            ...lane,
            cards: [
              ...lane.cards.slice(0, location.cardIndex + 1),
              copy,
              ...lane.cards.slice(location.cardIndex + 1),
            ],
          }
        : lane,
    ),
  };
}

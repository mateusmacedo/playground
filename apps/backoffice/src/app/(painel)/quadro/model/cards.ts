import {
  type Board,
  type BoardCard,
  type BoardLane,
  findCard,
  updateCardIn,
} from './board';
import { cardKey } from './card-key';
import { moveCard } from './card-moves';

export type CardPatch = Partial<Pick<BoardCard, 'title' | 'description'>>;

/** Dados do card que entra no quadro. */
export interface NewCardData {
  readonly id: string;
  readonly title: string;
  readonly parentId?: string;
  readonly number?: number;
  /** Responsável herdado do pai (regra `childInherits`). */
  readonly assigneeId?: string;
  /** Etiquetas herdadas do pai (regra `childInherits`). */
  readonly labelIds?: readonly string[];
}

export interface AddCardParams {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly card: NewCardData;
}

/** Responsável e etiquetas que o card novo traz; o que não veio fica de fora do card. */
function inheritedOf(card: NewCardData): Partial<BoardCard> {
  const inherited: { assigneeId?: string; labelIds?: readonly string[] } = {};
  if (card.assigneeId !== undefined) {
    inherited.assigneeId = card.assigneeId;
  }
  if (card.labelIds !== undefined) {
    inherited.labelIds = card.labelIds;
  }
  return inherited;
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
    ...inheritedOf(card),
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

/** O card e a edição que a pessoa fez nele. */
interface CardEdit {
  readonly card: BoardCard;
  readonly patch: CardPatch;
}

/** Título depois da edição; o vazio mantém o anterior. */
function editedTitle(edit: CardEdit): string {
  const typed = edit.patch.title?.trim();
  if (!typed) {
    return edit.card.title;
  }
  return typed;
}

/** Descrição depois da edição; a que só tem espaços some. */
function editedDescription(edit: CardEdit): string | undefined {
  const { description } = edit.patch;
  if (description === undefined) {
    return edit.card.description;
  }
  // NOTE: a descrição não é aparada, para não comer o espaço que a pessoa acabou de digitar; só a vazia some.
  if (description.trim() === '') {
    return undefined;
  }
  return description;
}

/** Aplica a edição do card. Título vazio mantém o anterior, e descrição só com espaços some. */
export function updateCard(params: UpdateCardParams): readonly BoardLane[] {
  const { lanes, cardId, patch } = params;
  return updateCardIn({
    lanes,
    cardId,
    update: (card) => {
      const title = editedTitle({ card, patch });
      const description = editedDescription({ card, patch });
      if (title === card.title && description === card.description) {
        return card;
      }
      return { ...card, title, description };
    },
  });
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
  const nextLanes: BoardLane[] = [];
  for (const lane of lanes) {
    const cards: BoardCard[] = [];
    for (const card of lane.cards) {
      if (card.id === cardId) {
        continue;
      }
      const isChild = card.parentId === cardId;
      cards.push(isChild ? { ...card, parentId: grandparentId } : card);
    }
    nextLanes.push({ ...lane, cards });
  }
  return nextLanes;
}

export interface DuplicateCardParams {
  readonly board: Board;
  readonly cardId: string;
  readonly newId: string;
  readonly at: string;
}

/**
 * Duplica o card logo abaixo do original, com o título marcado como cópia, os mesmos dados e o mesmo pai, mas sem os
 * filhos nem o histórico, que começa registrando de onde a cópia veio. A execução do processo, a etapa que o card
 * executa e os bloqueadores ficam só no original: são andamento, não dado do card.
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
    process: undefined,
    stepOf: undefined,
    blockedBy: undefined,
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

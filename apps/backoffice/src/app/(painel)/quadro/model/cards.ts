import { type BoardCard, type BoardLane, findCard, moveCard } from './board';

export type CardPatch = Partial<Pick<BoardCard, 'title' | 'description'>>;

/** Acrescenta o card no fim da coluna; título vazio ou coluna inexistente não criam nada. */
export function addCard(params: {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly card: {
    readonly id: string;
    readonly title: string;
    readonly parentId?: string;
  };
}): readonly BoardLane[] {
  const { lanes, laneId, card } = params;
  const title = card.title.trim();
  if (!title || !lanes.some((lane) => lane.id === laneId)) {
    return lanes;
  }
  const created: BoardCard = { id: card.id, title, parentId: card.parentId };
  return lanes.map((lane) =>
    lane.id === laneId ? { ...lane, cards: [...lane.cards, created] } : lane,
  );
}

/** Aplica a edição do card. Título vazio mantém o anterior, e descrição só com espaços some. */
export function updateCard(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly patch: CardPatch;
}): readonly BoardLane[] {
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

/** Leva o card para o fim de outra coluna; na própria coluna, não muda nada. */
export function moveCardToLane(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly laneId: string;
}): readonly BoardLane[] {
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

/** Exclui o card. Os filhos dele sobem um nível: passam para o pai do card excluído ou ficam sem pai. */
export function removeCard(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}): readonly BoardLane[] {
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

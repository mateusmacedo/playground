/** Card do quadro sem saber o que representa: só a identidade e o que aparece na tela. */
export interface BoardCard {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  /** Card pai na hierarquia; pai e filho podem estar em colunas diferentes. */
  readonly parentId?: string;
}

/** Coluna do quadro; a ordem de `cards` é a ordem na tela. */
export interface BoardLane {
  readonly id: string;
  readonly title: string;
  readonly cards: readonly BoardCard[];
  /** Máximo de cards esperado na coluna (o limite de WIP); passar dele só gera destaque, não bloqueia. */
  readonly wipLimit?: number;
}

export interface CardLocation {
  readonly lane: BoardLane;
  readonly laneIndex: number;
  readonly card: BoardCard;
  readonly cardIndex: number;
}

export type StepDirection = 'up' | 'down' | 'left' | 'right';

export function findCard(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}): CardLocation | undefined {
  const { lanes, cardId } = params;
  for (const [laneIndex, lane] of lanes.entries()) {
    const cardIndex = lane.cards.findIndex((card) => card.id === cardId);
    const card = lane.cards[cardIndex];
    if (card) {
      return { lane, laneIndex, card, cardIndex };
    }
  }
  return undefined;
}

/** Todos os cards do quadro, coluna por coluna, na ordem da tela. */
export function allCards(lanes: readonly BoardLane[]): readonly BoardCard[] {
  return lanes.flatMap((lane) => lane.cards);
}

/**
 * Devolve o quadro com o card na nova posição, sem alterar o original. Card ou coluna inexistente e movimento para o
 * mesmo lugar devolvem o próprio `lanes`, então repetir um movimento não muda nada.
 */
export function moveCard(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly toLaneId: string;
  /** Posição final na coluna de destino, contada sem o próprio card; fora da faixa, vai para a ponta mais próxima. */
  readonly toIndex: number;
}): readonly BoardLane[] {
  const { lanes, cardId, toLaneId } = params;
  const origin = findCard({ lanes, cardId });
  const destination = lanes.find((lane) => lane.id === toLaneId);
  if (!origin || !destination) {
    return lanes;
  }

  const remaining = destination.cards.filter((card) => card.id !== cardId);
  const toIndex = Math.min(Math.max(params.toIndex, 0), remaining.length);
  const sameLane = origin.lane.id === destination.id;
  if (sameLane && origin.cardIndex === toIndex) {
    return lanes;
  }

  const destinationCards = [
    ...remaining.slice(0, toIndex),
    origin.card,
    ...remaining.slice(toIndex),
  ];
  return lanes.map((lane) => {
    if (lane.id === destination.id) {
      return { ...lane, cards: destinationCards };
    }
    if (lane.id === origin.lane.id) {
      return {
        ...lane,
        cards: lane.cards.filter((card) => card.id !== cardId),
      };
    }
    return lane;
  });
}

/**
 * Converte a fenda onde o card foi solto (antes do card que está na posição `slot` da coluna, como aparece na tela)
 * na posição final do `moveCard`. Na mesma coluna, abaixo da origem, a fenda conta o próprio card e perde uma posição.
 */
export function slotToIndex(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly laneId: string;
  readonly slot: number;
}): number {
  const { lanes, cardId, laneId, slot } = params;
  const origin = findCard({ lanes, cardId });
  if (origin && origin.lane.id === laneId && slot > origin.cardIndex) {
    return slot - 1;
  }
  return slot;
}

/** Um passo do teclado: acima ou abaixo na mesma coluna, ou para a coluna vizinha mantendo a altura possível. */
export function stepCard(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly direction: StepDirection;
}): readonly BoardLane[] {
  const { lanes, cardId, direction } = params;
  const origin = findCard({ lanes, cardId });
  if (!origin) {
    return lanes;
  }

  if (direction === 'up' || direction === 'down') {
    const offset = direction === 'up' ? -1 : 1;
    return moveCard({
      lanes,
      cardId,
      toLaneId: origin.lane.id,
      toIndex: origin.cardIndex + offset,
    });
  }

  const neighborIndex =
    direction === 'left' ? origin.laneIndex - 1 : origin.laneIndex + 1;
  const neighbor = lanes[neighborIndex];
  if (!neighbor) {
    return lanes;
  }
  return moveCard({
    lanes,
    cardId,
    toLaneId: neighbor.id,
    toIndex: origin.cardIndex,
  });
}

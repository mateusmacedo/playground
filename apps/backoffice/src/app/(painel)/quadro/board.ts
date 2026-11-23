/** Card do quadro sem saber o que representa: só a identidade e o que aparece na tela. */
export interface BoardCard {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
}

/** Coluna do quadro; a ordem de `cards` é a ordem na tela. */
export interface BoardLane {
  readonly id: string;
  readonly title: string;
  readonly cards: readonly BoardCard[];
}

export interface CardLocation {
  readonly lane: BoardLane;
  readonly laneIndex: number;
  readonly card: BoardCard;
  readonly cardIndex: number;
}

export interface CardMove {
  readonly cardId: string;
  readonly toLaneId: string;
  /** Posição final na coluna de destino, contada sem o próprio card; fora da faixa, vai para a ponta mais próxima. */
  readonly toIndex: number;
}

export type StepDirection = 'up' | 'down' | 'left' | 'right';

export function findCard(
  lanes: readonly BoardLane[],
  cardId: string,
): CardLocation | undefined {
  for (const [laneIndex, lane] of lanes.entries()) {
    const cardIndex = lane.cards.findIndex((card) => card.id === cardId);
    const card = lane.cards[cardIndex];
    if (card) {
      return { lane, laneIndex, card, cardIndex };
    }
  }
  return undefined;
}

/**
 * Devolve o quadro com o card na nova posição, sem alterar o original. Card ou coluna inexistente e movimento para o
 * mesmo lugar devolvem o próprio `lanes`, então repetir um movimento não muda nada.
 */
export function moveCard(
  lanes: readonly BoardLane[],
  move: CardMove,
): readonly BoardLane[] {
  const origin = findCard(lanes, move.cardId);
  const destination = lanes.find((lane) => lane.id === move.toLaneId);
  if (!origin || !destination) {
    return lanes;
  }

  const remaining = destination.cards.filter((card) => card.id !== move.cardId);
  const toIndex = Math.min(Math.max(move.toIndex, 0), remaining.length);
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
        cards: lane.cards.filter((card) => card.id !== move.cardId),
      };
    }
    return lane;
  });
}

/**
 * Converte a fenda onde o card foi solto (antes do card que está na posição `slot` da coluna, como aparece na tela)
 * na posição final do `moveCard`. Na mesma coluna, abaixo da origem, a fenda conta o próprio card e perde uma posição.
 */
export function slotToIndex(
  lanes: readonly BoardLane[],
  drop: {
    readonly cardId: string;
    readonly laneId: string;
    readonly slot: number;
  },
): number {
  const origin = findCard(lanes, drop.cardId);
  if (
    origin &&
    origin.lane.id === drop.laneId &&
    drop.slot > origin.cardIndex
  ) {
    return drop.slot - 1;
  }
  return drop.slot;
}

/** Um passo do teclado: acima ou abaixo na mesma coluna, ou para a coluna vizinha mantendo a altura possível. */
export function stepCard(
  lanes: readonly BoardLane[],
  step: { readonly cardId: string; readonly direction: StepDirection },
): readonly BoardLane[] {
  const origin = findCard(lanes, step.cardId);
  if (!origin) {
    return lanes;
  }

  const { cardId, direction } = step;
  if (direction === 'up' || direction === 'down') {
    const offset = direction === 'up' ? -1 : 1;
    return moveCard(lanes, {
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
  return moveCard(lanes, {
    cardId,
    toLaneId: neighbor.id,
    toIndex: origin.cardIndex,
  });
}

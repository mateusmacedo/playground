import { type BoardLane, findCard } from './board';

export type StepDirection = 'up' | 'down' | 'left' | 'right';

export interface MoveCardParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly toLaneId: string;
  /** Posição final na coluna de destino, contada sem o próprio card; fora da faixa, vai para a ponta mais próxima. */
  readonly toIndex: number;
}

/**
 * Devolve o quadro com o card na nova posição, sem alterar o original. Card ou coluna inexistente e movimento para o
 * mesmo lugar devolvem o próprio `lanes`, então repetir um movimento não muda nada.
 */
export function moveCard(params: MoveCardParams): readonly BoardLane[] {
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

export interface SlotToIndexParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly laneId: string;
  readonly slot: number;
}

/**
 * Converte a fenda onde o card foi solto (antes do card que está na posição `slot` da coluna, como aparece na tela)
 * na posição final do `moveCard`. Na mesma coluna, abaixo da origem, a fenda conta o próprio card e perde uma posição.
 */
export function slotToIndex(params: SlotToIndexParams): number {
  const { lanes, cardId, laneId, slot } = params;
  const origin = findCard({ lanes, cardId });
  if (origin && origin.lane.id === laneId && slot > origin.cardIndex) {
    return slot - 1;
  }
  return slot;
}

export interface StepCardParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly direction: StepDirection;
}

/** Um passo do teclado: acima ou abaixo na mesma coluna, ou para a coluna vizinha mantendo a altura possível. */
export function stepCard(params: StepCardParams): readonly BoardLane[] {
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

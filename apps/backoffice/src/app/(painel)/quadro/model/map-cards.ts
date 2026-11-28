import type { BoardCard, BoardLane } from './board';

export interface MapCardsParams {
  readonly lanes: readonly BoardLane[];
  /** Devolve o próprio card quando não há o que mudar nele. */
  readonly update: (card: BoardCard) => BoardCard;
}

/**
 * Aplica `update` a cada card das colunas. A coluna sem card mudado continua o mesmo objeto, e sem mudança nenhuma
 * volta o próprio `lanes`, para quem compara por referência não ver mudança onde não houve.
 */
export function mapCards(params: MapCardsParams): readonly BoardLane[] {
  const { lanes, update } = params;
  let changed = false;
  const next: BoardLane[] = [];
  for (const lane of lanes) {
    const cards = lane.cards.map(update);
    const sameCards = cards.every((card, index) => card === lane.cards[index]);
    if (sameCards) {
      next.push(lane);
      continue;
    }
    changed = true;
    next.push({ ...lane, cards });
  }
  return changed ? next : lanes;
}

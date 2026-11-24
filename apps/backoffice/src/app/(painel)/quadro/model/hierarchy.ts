import { allCards, type BoardCard, type BoardLane, findCard } from './board';

/** Filhos diretos do card, na ordem da tela. */
export function childrenOf(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}): readonly BoardCard[] {
  return allCards(params.lanes).filter(
    (card) => card.parentId === params.cardId,
  );
}

/** Cadeia de pais do card, do pai direto até a raiz. Para num pai inexistente ou num ciclo. */
export function ancestorsOf(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}): readonly BoardCard[] {
  const { lanes, cardId } = params;
  const ancestors: BoardCard[] = [];
  const visited = new Set([cardId]);
  let parentId = findCard({ lanes, cardId })?.card.parentId;
  while (parentId && !visited.has(parentId)) {
    const parent = findCard({ lanes, cardId: parentId })?.card;
    if (!parent) {
      break;
    }
    ancestors.push(parent);
    visited.add(parent.id);
    parentId = parent.parentId;
  }
  return ancestors;
}

/** Quantos filhos diretos cada card tem; cards sem filhos ficam de fora. */
export function childCounts(
  lanes: readonly BoardLane[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const card of allCards(lanes)) {
    if (card.parentId) {
      counts.set(card.parentId, (counts.get(card.parentId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Ids de todos os descendentes do card: filhos, netos e assim por diante. */
export function descendantIds(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}): ReadonlySet<string> {
  const cards = allCards(params.lanes);
  const found = new Set<string>();
  const pending = [params.cardId];
  for (let current = pending.pop(); current; current = pending.pop()) {
    for (const card of cards) {
      if (card.parentId === current && !found.has(card.id)) {
        found.add(card.id);
        pending.push(card.id);
      }
    }
  }
  return found;
}

/** Cards que podem ser pai do card: todos, menos ele mesmo e os descendentes dele, que fechariam um ciclo. */
export function parentCandidates(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}): readonly BoardCard[] {
  const { lanes, cardId } = params;
  const blocked = descendantIds({ lanes, cardId });
  return allCards(lanes).filter(
    (card) => card.id !== cardId && !blocked.has(card.id),
  );
}

/** Liga o card a um pai, ou o solta com `undefined`. Pai inexistente ou que fecharia um ciclo não muda nada. */
export function setParent(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly parentId: string | undefined;
}): readonly BoardLane[] {
  const { lanes, cardId, parentId } = params;
  const location = findCard({ lanes, cardId });
  if (!location || location.card.parentId === parentId) {
    return lanes;
  }
  if (
    parentId !== undefined &&
    !parentCandidates({ lanes, cardId }).some((card) => card.id === parentId)
  ) {
    return lanes;
  }
  return lanes.map((lane) =>
    lane.id === location.lane.id
      ? {
          ...lane,
          cards: lane.cards.map((card) =>
            card.id === cardId ? { ...card, parentId } : card,
          ),
        }
      : lane,
  );
}

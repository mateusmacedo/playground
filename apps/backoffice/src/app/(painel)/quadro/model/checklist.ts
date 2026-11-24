import { type BoardCard, type BoardLane, updateCardIn } from './board';
import { nextId } from './ids';

/** Acrescenta o item no fim do checklist; texto vazio não cria nada. */
export function addChecklistItem(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly text: string;
}): readonly BoardLane[] {
  const text = params.text.trim();
  if (!text) {
    return params.lanes;
  }
  return updateCardIn({
    lanes: params.lanes,
    cardId: params.cardId,
    update: (card) => {
      const items = card.checklist ?? [];
      const id = nextId({
        prefix: 'item',
        taken: items.map((item) => item.id),
      });
      return { ...card, checklist: [...items, { id, text, done: false }] };
    },
  });
}

/** Marca o item como feito, ou desmarca. */
export function toggleChecklistItem(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly itemId: string;
}): readonly BoardLane[] {
  const { itemId } = params;
  return updateCardIn({
    lanes: params.lanes,
    cardId: params.cardId,
    update: (card) =>
      card.checklist?.some((item) => item.id === itemId)
        ? {
            ...card,
            checklist: card.checklist.map((item) =>
              item.id === itemId ? { ...item, done: !item.done } : item,
            ),
          }
        : card,
  });
}

/** Tira o item do checklist; o checklist que fica vazio some do card. */
export function removeChecklistItem(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly itemId: string;
}): readonly BoardLane[] {
  const { itemId } = params;
  return updateCardIn({
    lanes: params.lanes,
    cardId: params.cardId,
    update: (card) => {
      if (!card.checklist?.some((item) => item.id === itemId)) {
        return card;
      }
      const checklist = card.checklist.filter((item) => item.id !== itemId);
      return {
        ...card,
        checklist: checklist.length > 0 ? checklist : undefined,
      };
    },
  });
}

export function checklistProgress(card: BoardCard): {
  readonly done: number;
  readonly total: number;
} {
  const items = card.checklist ?? [];
  return {
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
}

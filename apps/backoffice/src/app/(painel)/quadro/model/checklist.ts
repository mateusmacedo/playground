import { type BoardCard, type BoardLane, updateCardIn } from './board';
import { nextId } from './ids';

export interface AddChecklistItemParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly text: string;
}

/** Acrescenta o item no fim do checklist; texto vazio não cria nada. */
export function addChecklistItem(
  params: AddChecklistItemParams,
): readonly BoardLane[] {
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

export interface ToggleChecklistItemParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly itemId: string;
}

/** Marca o item como feito, ou desmarca. */
export function toggleChecklistItem(
  params: ToggleChecklistItemParams,
): readonly BoardLane[] {
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

export interface RemoveChecklistItemParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly itemId: string;
}

/** Tira o item do checklist; o checklist que fica vazio some do card. */
export function removeChecklistItem(
  params: RemoveChecklistItemParams,
): readonly BoardLane[] {
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

export interface ChecklistProgress {
  readonly done: number;
  readonly total: number;
}

export function checklistProgress(card: BoardCard): ChecklistProgress {
  const items = card.checklist ?? [];
  return {
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
}

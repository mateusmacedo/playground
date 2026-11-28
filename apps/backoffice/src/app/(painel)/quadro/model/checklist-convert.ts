import { type Board, findCard, updateCardIn } from './board';
import { addCard } from './cards';
import { removeChecklistItem } from './checklist';
import { inheritedFromParent } from './child-inherit';
import { CARD_MISSING, type ProcessChange, refusedChange } from './process-run';

export const ITEM_MISSING = 'O item não está mais no checklist do card.';

/** Título do card filho quando o item não tem texto. */
export const UNNAMED_ITEM_TITLE = 'Item do checklist';

export interface ConvertChecklistItemParams {
  readonly board: Board;
  readonly cardId: string;
  readonly itemId: string;
  /** Id do card filho. */
  readonly newId: string;
  /** Instante da conversão, ISO 8601. */
  readonly at: string;
}

/**
 * O item do checklist vira card filho: sai do checklist e nasce com o texto dele no fim da coluna do pai, registrando
 * de onde veio; com a regra `childInherits`, herda o responsável e as etiquetas do pai. Recusa o card ou o item que não
 * existem e a coluna bloqueada, que não recebe card.
 */
export function convertChecklistItem(
  params: ConvertChecklistItemParams,
): ProcessChange {
  const { board, cardId, itemId, newId, at } = params;
  const location = findCard({ lanes: board.lanes, cardId });
  if (!location) {
    return refusedChange(CARD_MISSING);
  }
  const { card, lane } = location;
  const item = card.checklist?.find((candidate) => candidate.id === itemId);
  if (!item) {
    return refusedChange(ITEM_MISSING);
  }
  if (lane.locked) {
    return refusedChange(
      `A coluna ${lane.title} está bloqueada: libere a coluna para criar o card filho.`,
    );
  }
  const withoutItem = removeChecklistItem({
    lanes: board.lanes,
    cardId,
    itemId,
  });
  const created = addCard({
    lanes: withoutItem,
    laneId: lane.id,
    card: {
      id: newId,
      title: item.text.trim() || UNNAMED_ITEM_TITLE,
      parentId: cardId,
      number: board.nextNumber,
      ...inheritedFromParent({ board, parentId: cardId }),
    },
  });
  const lanes = updateCardIn({
    lanes: created,
    cardId: newId,
    update: (child) => ({
      ...child,
      activity: [
        { at, kind: 'from-checklist', lane: lane.title, parent: card.title },
      ],
    }),
  });
  return {
    ok: true,
    board: { ...board, lanes, nextNumber: board.nextNumber + 1 },
  };
}

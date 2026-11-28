import type { BoardCard, CardActivity } from './board';
import { checklistProgress } from './checklist';

/** Cada card do quadro, pelo id, antes e depois da mudança. */
export interface CardsPair {
  readonly before: ReadonlyMap<string, { readonly card: BoardCard }>;
  readonly after: ReadonlyMap<string, { readonly card: BoardCard }>;
}

export interface LinkChangesParams {
  readonly before: BoardCard;
  readonly after: BoardCard;
  readonly titles: CardsPair;
  readonly at: string;
}

interface TitleInParams {
  readonly cardId: string;
  readonly titles: CardsPair;
}

/** Título do card, de depois da mudança ou, quando ele saiu do quadro, de antes; o id quando não há nenhum. */
function titleIn(params: TitleInParams): string {
  const { cardId, titles } = params;
  const placement = titles.after.get(cardId) ?? titles.before.get(cardId);
  return placement?.card.title ?? cardId;
}

/** Bloqueadores que entraram e que saíram do card, um registro por bloqueador. */
export function blockerChanges(
  params: LinkChangesParams,
): readonly CardActivity[] {
  const { at, titles } = params;
  const before = params.before.blockedBy ?? [];
  const after = params.after.blockedBy ?? [];
  if (before === after) {
    return [];
  }
  const changes: CardActivity[] = [];
  for (const cardId of after) {
    if (!before.includes(cardId)) {
      const blocker = titleIn({ cardId, titles });
      changes.push({ at, kind: 'blocker-added', blocker });
    }
  }
  for (const cardId of before) {
    if (!after.includes(cardId)) {
      const blocker = titleIn({ cardId, titles });
      changes.push({ at, kind: 'blocker-removed', blocker });
    }
  }
  return changes;
}

interface NewChildParams {
  readonly parent: BoardCard;
  readonly titles: CardsPair;
}

/** Diz se a mudança criou um card filho a partir do checklist: o filho chega registrando de onde saiu. */
function gotChecklistChild(params: NewChildParams): boolean {
  const { parent, titles } = params;
  for (const [id, placement] of titles.after) {
    const { card } = placement;
    const isNew = !titles.before.has(id);
    const origin = card.activity?.[0];
    if (
      isNew &&
      card.parentId === parent.id &&
      origin?.kind === 'from-checklist'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * O que a mudança do checklist registra no card: o item que virou card filho, ou, em qualquer outra mudança, quantos
 * itens estão feitos.
 */
export function checklistChange(params: LinkChangesParams): CardActivity {
  const { before, after, titles, at } = params;
  const kept = new Set(after.checklist?.map((item) => item.id));
  const removed = (before.checklist ?? []).filter((item) => !kept.has(item.id));
  const [converted] = removed;
  if (
    removed.length === 1 &&
    converted &&
    gotChecklistChild({ parent: after, titles })
  ) {
    return { at, kind: 'checklist-converted', item: converted.text };
  }
  return { at, kind: 'checklist', ...checklistProgress(after) };
}

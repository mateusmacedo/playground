import type { BoardCard, BoardLabel } from './board';
import { cardKey } from './card-key';

/** Texto para comparação: minúsculo e sem acentos. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export interface CardMatchesQueryParams {
  readonly card: BoardCard;
  readonly query: string;
  readonly labels: readonly BoardLabel[];
  /** Prefixo do código dos cards do quadro. */
  readonly keyPrefix: string;
}

/**
 * O card bate com a busca quando cada palavra dela aparece no título, na descrição, no código, no nome das etiquetas
 * ou nos itens do checklist. Busca vazia bate com tudo.
 */
export function cardMatchesQuery(params: CardMatchesQueryParams): boolean {
  const { card, query, labels, keyPrefix } = params;
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return true;
  }
  const labelNames = labels
    .filter((label) => card.labelIds?.includes(label.id))
    .map((label) => label.name);
  const haystack = normalizeText(
    [
      card.title,
      card.description ?? '',
      cardKey({ card, prefix: keyPrefix }),
      ...labelNames,
      ...(card.checklist ?? []).map((item) => item.text),
    ].join(' '),
  );
  return words.every((word) => haystack.includes(word));
}

export interface CardMatchesLabelsParams {
  readonly card: BoardCard;
  readonly labelIds: ReadonlySet<string>;
}

/** Sem etiqueta escolhida, todo card passa; com etiquetas, passa o card que tem qualquer uma delas. */
export function cardMatchesLabels(params: CardMatchesLabelsParams): boolean {
  const { card, labelIds } = params;
  return (
    labelIds.size === 0 || (card.labelIds ?? []).some((id) => labelIds.has(id))
  );
}

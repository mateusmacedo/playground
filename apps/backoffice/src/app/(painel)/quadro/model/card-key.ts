import { allCards, type Board, type BoardCard } from './board';
import { archivedCards } from './board-state';

/** Prefixo do código dos cards; fixo até o quadro ganhar uma especialidade que defina o dela. */
export const CARD_KEY_PREFIX = 'QD';

/** Código curto do card, como no Jira e no Linear: `QD-12`. */
export function cardKey(card: Pick<BoardCard, 'number'>): string {
  return `${CARD_KEY_PREFIX}-${card.number ?? '?'}`;
}

/** Número do código escrito pela pessoa (`QD-12`, `qd-12`); `undefined` quando não é um código. */
export function parseCardKey(text: string): number | undefined {
  const match = new RegExp(`^${CARD_KEY_PREFIX}-(\\d+)$`, 'i').exec(
    text.trim(),
  );
  return match ? Number(match[1]) : undefined;
}

export type CardLookup =
  | { readonly kind: 'live'; readonly cardId: string }
  | { readonly kind: 'archived'; readonly cardId: string }
  | { readonly kind: 'missing' };

/** Onde está o card do código: no quadro, no arquivo ou em lugar nenhum. */
export function findByKey(params: {
  readonly board: Board;
  readonly key: string;
}): CardLookup {
  const number = parseCardKey(params.key);
  if (number === undefined) {
    return { kind: 'missing' };
  }
  const live = allCards(params.board.lanes).find(
    (card) => card.number === number,
  );
  if (live) {
    return { kind: 'live', cardId: live.id };
  }
  const archived = archivedCards(params.board).find(
    (card) => card.number === number,
  );
  return archived
    ? { kind: 'archived', cardId: archived.id }
    : { kind: 'missing' };
}

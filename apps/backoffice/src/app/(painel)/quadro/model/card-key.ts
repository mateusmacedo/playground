import { allCards, type Board, type BoardCard } from './board';
import { archivedCards } from './board-state';

/** Código curto do card, como no Jira e no Linear: o prefixo do quadro e o número (`QD-12`). */
export function cardKey(params: {
  readonly card: Pick<BoardCard, 'number'>;
  readonly prefix: string;
}): string {
  return `${params.prefix}-${params.card.number ?? '?'}`;
}

/** Número do código escrito pela pessoa (`QD-12`, `qd-12`); `undefined` quando não é um código do prefixo. */
export function parseCardKey(params: {
  readonly text: string;
  readonly prefix: string;
}): number | undefined {
  const match = new RegExp(`^${params.prefix}-(\\d+)$`, 'i').exec(
    params.text.trim(),
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
  const number = parseCardKey({
    text: params.key,
    prefix: params.board.config.keyPrefix,
  });
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

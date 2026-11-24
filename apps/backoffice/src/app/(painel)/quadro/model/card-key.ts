import { allCards, type Board, type BoardCard } from './board';
import { archivedCards } from './board-state';

export interface CardKeyParams {
  readonly card: Pick<BoardCard, 'number'>;
  readonly prefix: string;
}

/** Código curto do card, como no Jira e no Linear: o prefixo do quadro e o número (`QD-12`). */
export function cardKey(params: CardKeyParams): string {
  return `${params.prefix}-${params.card.number ?? '?'}`;
}

export interface ParseCardKeyParams {
  readonly text: string;
  readonly prefix: string;
}

/** Número do código escrito pela pessoa (`QD-12`, `qd-12`); `undefined` quando não é um código do prefixo. */
export function parseCardKey(params: ParseCardKeyParams): number | undefined {
  const match = new RegExp(`^${params.prefix}-(\\d+)$`, 'i').exec(
    params.text.trim(),
  );
  return match ? Number(match[1]) : undefined;
}

export type CardLookup =
  | { readonly kind: 'live'; readonly cardId: string }
  | { readonly kind: 'archived'; readonly cardId: string }
  | { readonly kind: 'missing' };

export interface FindByKeyParams {
  readonly board: Board;
  readonly key: string;
}

/** Onde está o card do código: no quadro, no arquivo ou em lugar nenhum. */
export function findByKey(params: FindByKeyParams): CardLookup {
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

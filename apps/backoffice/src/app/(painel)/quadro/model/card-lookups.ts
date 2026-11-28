import { allCards, type Board, type BoardLane } from './board';
import { aggregateProgress, type ChildProgress } from './completion';
import { blockedCardIds } from './dependencies';
import { childCounts } from './hierarchy';

/** Consultas por id que as visões do quadro fazem a cada card desenhado. */
export interface CardLookups {
  /** Título de cada card que está na tela; serve para mostrar o nome do card pai. */
  readonly titles: ReadonlyMap<string, string>;
  /** Quantos filhos diretos cada card tem. */
  readonly childCounts: ReadonlyMap<string, number>;
  /** Descendentes na coluna de conclusão, quando o quadro tem uma. */
  readonly progress: ReadonlyMap<string, ChildProgress>;
  /** Nome de cada pessoa do quadro. */
  readonly people: ReadonlyMap<string, string>;
  /** Cards com bloqueador fora da coluna de conclusão. */
  readonly blocked: ReadonlySet<string>;
}

export interface CardLookupsParams {
  readonly board: Board;
  /** As colunas que estão na tela. */
  readonly shown: readonly BoardLane[];
}

export function cardLookups(params: CardLookupsParams): CardLookups {
  const { board, shown } = params;

  const titles = new Map<string, string>();
  for (const card of allCards(shown)) {
    titles.set(card.id, card.title);
  }

  const people = new Map<string, string>();
  for (const person of board.config.people ?? []) {
    people.set(person.id, person.name);
  }

  return {
    titles,
    childCounts: childCounts(board.lanes),
    progress: aggregateProgress({
      lanes: board.lanes,
      doneLaneId: board.config.doneLaneId,
    }),
    people,
    blocked: blockedCardIds(board),
  };
}

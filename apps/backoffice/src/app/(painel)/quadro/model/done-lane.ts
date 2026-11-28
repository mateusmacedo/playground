import type { BoardPair } from './activity-changes';
import { type Board, type BoardCard, type BoardLane, findCard } from './board';
import { moveCard } from './card-moves';

/** Coluna de conclusão do quadro; `undefined` sem ela ou quando ela não existe mais. */
export function doneLaneOf(board: Board): BoardLane | undefined {
  const { doneLaneId } = board.config;
  if (doneLaneId === undefined) {
    return undefined;
  }
  return board.lanes.find((lane) => lane.id === doneLaneId);
}

function cardIdsIn(lane: BoardLane | undefined): ReadonlySet<string> {
  return new Set(lane?.cards.map((card) => card.id));
}

/**
 * Cards que a mudança pôs na coluna de conclusão, venham de outra coluna, do arquivo ou de uma criação. Trocar a
 * coluna de conclusão não conta: o card que já estava nela não entrou.
 */
export function enteredDone(pair: BoardPair): readonly BoardCard[] {
  const done = doneLaneOf(pair.after);
  if (!done) {
    return [];
  }
  const sameLaneBefore = pair.before.lanes.find((lane) => lane.id === done.id);
  const alreadyThere = cardIdsIn(sameLaneBefore);
  return done.cards.filter((card) => !alreadyThere.has(card.id));
}

/** Cards que a mudança levou de outra coluna para a de conclusão; o criado ou restaurado nela não foi levado. */
export function movedIntoDone(pair: BoardPair): readonly BoardCard[] {
  return enteredDone(pair).filter(
    (card) =>
      findCard({ lanes: pair.before.lanes, cardId: card.id }) !== undefined,
  );
}

export interface MoveToDoneParams {
  readonly board: Board;
  readonly cardId: string;
}

/**
 * Leva o card para o fim da coluna de conclusão. Devolve o próprio `board` quando não há coluna de conclusão, quando
 * o card já está nela ou não está no quadro, e quando a coluna dele ou a de conclusão está bloqueada.
 */
export function moveToDone(params: MoveToDoneParams): Board {
  const { board, cardId } = params;
  const done = doneLaneOf(board);
  const location = findCard({ lanes: board.lanes, cardId });
  if (!done || !location || location.lane.id === done.id) {
    return board;
  }
  if (done.locked || location.lane.locked) {
    return board;
  }
  const lanes = moveCard({
    lanes: board.lanes,
    cardId,
    toLaneId: done.id,
    toIndex: Number.POSITIVE_INFINITY,
  });
  return { ...board, lanes };
}

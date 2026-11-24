import type { BoardLane } from './board';

export type LaneDirection = 'left' | 'right';

/** Acrescenta a coluna no fim do quadro; nome vazio não cria nada. */
export function addLane(params: {
  readonly lanes: readonly BoardLane[];
  readonly lane: { readonly id: string; readonly title: string };
}): readonly BoardLane[] {
  const { lanes, lane } = params;
  const title = lane.title.trim();
  if (!title) {
    return lanes;
  }
  return [...lanes, { id: lane.id, title, cards: [] }];
}

/** Troca o nome da coluna; nome vazio mantém o anterior. */
export function renameLane(params: {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly title: string;
}): readonly BoardLane[] {
  const { lanes, laneId } = params;
  const title = params.title.trim();
  const lane = lanes.find((candidate) => candidate.id === laneId);
  if (!lane || !title || lane.title === title) {
    return lanes;
  }
  return lanes.map((candidate) =>
    candidate.id === laneId ? { ...candidate, title } : candidate,
  );
}

/**
 * Exclui a coluna e leva os cards dela para o fim de `moveCardsTo`. A última coluna do quadro não sai, e a coluna com
 * cards só sai com um destino válido.
 */
export function removeLane(params: {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly moveCardsTo?: string;
}): readonly BoardLane[] {
  const { lanes, laneId, moveCardsTo } = params;
  const lane = lanes.find((candidate) => candidate.id === laneId);
  if (!lane || lanes.length === 1) {
    return lanes;
  }
  const remaining = lanes.filter((candidate) => candidate.id !== laneId);
  if (lane.cards.length === 0) {
    return remaining;
  }
  if (!remaining.some((candidate) => candidate.id === moveCardsTo)) {
    return lanes;
  }
  return remaining.map((candidate) =>
    candidate.id === moveCardsTo
      ? { ...candidate, cards: [...candidate.cards, ...lane.cards] }
      : candidate,
  );
}

/** Devolve o quadro com a coluna na posição `toIndex`, contada sem ela; fora da faixa, vai para a ponta mais próxima. */
export function moveLane(params: {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly toIndex: number;
}): readonly BoardLane[] {
  const { lanes, laneId } = params;
  const fromIndex = lanes.findIndex((lane) => lane.id === laneId);
  const lane = lanes[fromIndex];
  if (!lane) {
    return lanes;
  }
  const remaining = lanes.filter((candidate) => candidate.id !== laneId);
  const toIndex = Math.min(Math.max(params.toIndex, 0), remaining.length);
  if (toIndex === fromIndex) {
    return lanes;
  }
  return [...remaining.slice(0, toIndex), lane, ...remaining.slice(toIndex)];
}

/**
 * Converte a fenda onde a coluna foi solta (antes da coluna na posição `slot`, como aparece na tela) na posição final
 * do `moveLane`. À direita da origem, a fenda conta a própria coluna e perde uma posição.
 */
export function laneSlotToIndex(params: {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly slot: number;
}): number {
  const { lanes, laneId, slot } = params;
  const fromIndex = lanes.findIndex((lane) => lane.id === laneId);
  return fromIndex !== -1 && slot > fromIndex ? slot - 1 : slot;
}

/** Um passo do teclado: troca a coluna de lugar com a vizinha da esquerda ou da direita. */
export function stepLane(params: {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly direction: LaneDirection;
}): readonly BoardLane[] {
  const { lanes, laneId, direction } = params;
  const fromIndex = lanes.findIndex((lane) => lane.id === laneId);
  if (fromIndex === -1) {
    return lanes;
  }
  return moveLane({
    lanes,
    laneId,
    toIndex: direction === 'left' ? fromIndex - 1 : fromIndex + 1,
  });
}

/** Define o limite de cards da coluna; `undefined` tira o limite, e um valor que não é inteiro positivo é ignorado. */
export function setWipLimit(params: {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly limit: number | undefined;
}): readonly BoardLane[] {
  const { lanes, laneId, limit } = params;
  const lane = lanes.find((candidate) => candidate.id === laneId);
  const valid = limit === undefined || (Number.isInteger(limit) && limit > 0);
  if (!lane || !valid || lane.wipLimit === limit) {
    return lanes;
  }
  return lanes.map((candidate) =>
    candidate.id === laneId ? { ...candidate, wipLimit: limit } : candidate,
  );
}

export function isOverLimit(lane: BoardLane): boolean {
  return lane.wipLimit !== undefined && lane.cards.length > lane.wipLimit;
}

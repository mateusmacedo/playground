import type { BoardLane } from './board';

/** Colunas na tela, sem as ocultas. */
export function visibleLanes(
  lanes: readonly BoardLane[],
): readonly BoardLane[] {
  // NOTE: sem coluna oculta, devolve a mesma lista, para quem compara por referência não ver mudança onde não houve.
  return lanes.some((lane) => lane.hidden)
    ? lanes.filter((lane) => !lane.hidden)
    : lanes;
}

/**
 * Devolve as colunas visíveis, depois de mexidas na tela, aos lugares delas entre as ocultas, que não saem do lugar.
 * Coluna visível a mais vai para o fim.
 */
export function mergeVisible(params: {
  readonly all: readonly BoardLane[];
  readonly visible: readonly BoardLane[];
}): readonly BoardLane[] {
  if (!params.all.some((lane) => lane.hidden)) {
    return params.visible;
  }
  const queue = [...params.visible];
  const merged = params.all.flatMap((lane) => {
    if (lane.hidden) {
      return [lane];
    }
    const next = queue.shift();
    return next ? [next] : [];
  });
  return [...merged, ...queue];
}

function patchLane(params: {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly patch: Partial<Pick<BoardLane, 'hidden' | 'locked'>>;
}): readonly BoardLane[] {
  const { lanes, laneId, patch } = params;
  const lane = lanes.find((candidate) => candidate.id === laneId);
  const key = Object.keys(patch)[0] as 'hidden' | 'locked' | undefined;
  if (!lane || !key || Boolean(lane[key]) === Boolean(patch[key])) {
    return lanes;
  }
  return lanes.map((candidate) =>
    candidate.id === laneId
      ? { ...candidate, [key]: patch[key] ? true : undefined }
      : candidate,
  );
}

/** Oculta ou mostra a coluna; a última coluna visível não pode ser ocultada. */
export function setLaneHidden(params: {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly hidden: boolean;
}): readonly BoardLane[] {
  const { lanes, laneId, hidden } = params;
  if (hidden && visibleLanes(lanes).every((lane) => lane.id === laneId)) {
    return lanes;
  }
  return patchLane({ lanes, laneId, patch: { hidden } });
}

/** Mostra todas as colunas ocultas. */
export function showAllLanes(
  lanes: readonly BoardLane[],
): readonly BoardLane[] {
  return lanes.some((lane) => lane.hidden)
    ? lanes.map((lane) => (lane.hidden ? { ...lane, hidden: undefined } : lane))
    : lanes;
}

/** Bloqueia ou libera a coluna: bloqueada, ela não recebe nem solta cards e não muda a ordem deles. */
export function setLaneLocked(params: {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly locked: boolean;
}): readonly BoardLane[] {
  return patchLane({
    lanes: params.lanes,
    laneId: params.laneId,
    patch: { locked: params.locked },
  });
}

function cardOrder(lane: BoardLane): string {
  return lane.cards.map((card) => card.id).join('\n');
}

/**
 * A mudança respeita os bloqueios: toda coluna bloqueada antes e depois continua com os mesmos cards, na mesma ordem,
 * e nenhuma coluna bloqueada some. Mudar o conteúdo de um card não conta.
 */
export function respectsLocks(params: {
  readonly before: readonly BoardLane[];
  readonly after: readonly BoardLane[];
}): boolean {
  return params.before.every((lane) => {
    if (!lane.locked) {
      return true;
    }
    const next = params.after.find((candidate) => candidate.id === lane.id);
    return (
      next !== undefined &&
      (!next.locked || cardOrder(next) === cardOrder(lane))
    );
  });
}

/** Coluna bloqueada que a mudança tentou alterar, para avisar quem tentou. */
export function brokenLock(params: {
  readonly before: readonly BoardLane[];
  readonly after: readonly BoardLane[];
}): BoardLane | undefined {
  return params.before.find(
    (lane) =>
      lane.locked && !respectsLocks({ before: [lane], after: params.after }),
  );
}

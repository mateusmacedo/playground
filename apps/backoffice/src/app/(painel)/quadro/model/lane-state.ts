import { type BoardLane, findCard } from './board';

/** Colunas na tela, sem as ocultas. */
export function visibleLanes(
  lanes: readonly BoardLane[],
): readonly BoardLane[] {
  const hasHidden = lanes.some((lane) => lane.hidden);
  if (!hasHidden) {
    // NOTE: devolve a mesma lista, para quem compara por referência não ver mudança onde não houve.
    return lanes;
  }
  return lanes.filter((lane) => !lane.hidden);
}

export interface MergeVisibleParams {
  /** Todas as colunas do quadro, na ordem gravada. */
  readonly all: readonly BoardLane[];
  /** As colunas visíveis, na ordem em que ficaram na tela. */
  readonly visible: readonly BoardLane[];
}

/**
 * Devolve as colunas visíveis, depois de mexidas na tela, aos lugares delas entre as ocultas, que não saem do lugar.
 * Coluna visível a mais vai para o fim.
 */
export function mergeVisible(params: MergeVisibleParams): readonly BoardLane[] {
  const { all, visible } = params;
  const hasHidden = all.some((lane) => lane.hidden);
  if (!hasHidden) {
    return visible;
  }
  const merged: BoardLane[] = [];
  let nextVisible = 0;
  for (const lane of all) {
    if (lane.hidden) {
      merged.push(lane);
      continue;
    }
    const replacement = visible[nextVisible];
    nextVisible += 1;
    if (replacement) {
      merged.push(replacement);
    }
  }
  const extras = visible.slice(nextVisible);
  return [...merged, ...extras];
}

/** Marca de coluna oculta ou bloqueada: `true` quando ligada; desligada, some do objeto em vez de ficar `false`. */
function markOf(on: boolean): true | undefined {
  if (on) {
    return true;
  }
  return undefined;
}

export interface SetLaneHiddenParams {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly hidden: boolean;
}

/** Oculta ou mostra a coluna; a última coluna visível não pode ser ocultada. */
export function setLaneHidden(
  params: SetLaneHiddenParams,
): readonly BoardLane[] {
  const { lanes, laneId, hidden } = params;
  const lane = lanes.find((candidate) => candidate.id === laneId);
  if (!lane || Boolean(lane.hidden) === hidden) {
    return lanes;
  }
  const otherVisible = visibleLanes(lanes).filter(
    (candidate) => candidate.id !== laneId,
  );
  if (hidden && otherVisible.length === 0) {
    return lanes;
  }
  const hiddenMark = markOf(hidden);
  return lanes.map((candidate) =>
    candidate.id === laneId ? { ...candidate, hidden: hiddenMark } : candidate,
  );
}

/** Mostra todas as colunas ocultas. */
export function showAllLanes(
  lanes: readonly BoardLane[],
): readonly BoardLane[] {
  const hasHidden = lanes.some((lane) => lane.hidden);
  if (!hasHidden) {
    return lanes;
  }
  return lanes.map((lane) =>
    lane.hidden ? { ...lane, hidden: undefined } : lane,
  );
}

export interface SetLaneLockedParams {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
  readonly locked: boolean;
}

/** Bloqueia ou libera a coluna: bloqueada, ela não recebe nem solta cards e não muda a ordem deles. */
export function setLaneLocked(
  params: SetLaneLockedParams,
): readonly BoardLane[] {
  const { lanes, laneId, locked } = params;
  const lane = lanes.find((candidate) => candidate.id === laneId);
  if (!lane || Boolean(lane.locked) === locked) {
    return lanes;
  }
  const lockedMark = markOf(locked);
  return lanes.map((candidate) =>
    candidate.id === laneId ? { ...candidate, locked: lockedMark } : candidate,
  );
}

/** Ids dos cards da coluna, na ordem, para comparar duas versões da mesma coluna. */
function cardOrder(lane: BoardLane): string {
  return lane.cards.map((card) => card.id).join('\n');
}

/** As colunas antes e depois de uma mudança. */
export interface LanesChange {
  readonly before: readonly BoardLane[];
  readonly after: readonly BoardLane[];
}

/**
 * Coluna bloqueada que a mudança alterou: sumiu, ou ficou com outros cards ou com outra ordem. Mudar o conteúdo de um
 * card não conta, e liberar a coluna na própria mudança também não.
 */
export function brokenLock(change: LanesChange): BoardLane | undefined {
  for (const lane of change.before) {
    if (!lane.locked) {
      continue;
    }
    const next = change.after.find((candidate) => candidate.id === lane.id);
    if (!next) {
      return lane;
    }
    if (next.locked && cardOrder(next) !== cardOrder(lane)) {
      return lane;
    }
  }
  return undefined;
}

/** A mudança respeita os bloqueios: não altera nenhuma coluna bloqueada. */
export function respectsLocks(change: LanesChange): boolean {
  return brokenLock(change) === undefined;
}

export interface LockedLaneOfParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  /** Coluna de destino, quando o card muda de coluna. */
  readonly laneId?: string;
}

/** Coluna bloqueada que impede mexer no card: a coluna onde ele está ou, se não, a de destino. */
export function lockedLaneOf(
  params: LockedLaneOfParams,
): BoardLane | undefined {
  const source = findCard({ lanes: params.lanes, cardId: params.cardId })?.lane;
  if (source?.locked) {
    return source;
  }
  const target = params.lanes.find((lane) => lane.id === params.laneId);
  return target?.locked ? target : undefined;
}

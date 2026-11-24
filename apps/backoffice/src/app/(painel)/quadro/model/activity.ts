import {
  type BoardPair,
  changesOf,
  type Placement,
  type PlacementsPair,
} from './activity-changes';
import type {
  ArchiveEntry,
  Board,
  BoardCard,
  BoardLane,
  CardActivity,
} from './board';

/** Quantos registros o histórico de um card guarda; os mais antigos saem primeiro. */
export const ACTIVITY_LIMIT = 50;

function placements(board: Board): ReadonlyMap<string, Placement> {
  const map = new Map<string, Placement>();
  for (const lane of board.lanes) {
    for (const card of lane.cards) {
      map.set(card.id, { card, laneTitle: lane.title });
    }
  }
  for (const entry of board.archive) {
    for (const { card } of entry.cards) {
      map.set(card.id, { card });
    }
  }
  return map;
}

/** Dois registros seguidos do histórico: o último gravado e o que chega. */
interface EntryPair {
  readonly last: CardActivity;
  readonly next: CardActivity;
}

/** Junta dois registros seguidos do mesmo tipo; `null` quando a junção não deixa mudança nenhuma. */
function mergeEntries(params: EntryPair): CardActivity | null {
  const { last, next } = params;
  if (
    (last.kind === 'moved' && next.kind === 'moved') ||
    (last.kind === 'renamed' && next.kind === 'renamed')
  ) {
    return last.from === next.to ? null : { ...next, from: last.from };
  }
  if (last.kind === 'parent' && next.kind === 'parent') {
    return last.from === next.to ? null : { ...next, from: last.from };
  }
  return next;
}

export interface AppendActivityParams {
  readonly list: readonly CardActivity[];
  readonly entries: readonly CardActivity[];
  readonly merge: boolean;
}

/**
 * Acrescenta os registros ao histórico. Com `merge`, um registro do mesmo tipo do último o substitui, guardando o
 * ponto de partida (o título de antes da digitação, a coluna de antes do movimento).
 */
export function appendActivity(
  params: AppendActivityParams,
): readonly CardActivity[] {
  const list = [...params.list];
  for (const entry of params.entries) {
    const last = list.at(-1);
    if (params.merge && last?.kind === entry.kind) {
      const merged = mergeEntries({ last, next: entry });
      list.pop();
      if (merged) {
        list.push(merged);
      }
    } else {
      list.push(entry);
    }
  }
  return list.slice(-ACTIVITY_LIMIT);
}

interface EntriesForParams {
  /** Onde o card estava antes da mudança; `undefined` quando o card é novo. */
  readonly previous: Placement | undefined;
  readonly current: Placement;
  readonly titles: PlacementsPair;
  readonly boards: BoardPair;
  readonly at: string;
}

/** O que entra no histórico do card com a mudança; lista vazia quando nada mudou nele. */
function entriesFor(params: EntriesForParams): readonly CardActivity[] {
  const { previous, current, titles, boards, at } = params;
  if (!previous) {
    const hasHistory = (current.card.activity?.length ?? 0) > 0;
    if (hasHistory || current.laneTitle === undefined) {
      return [];
    }
    return [{ at, kind: 'created', lane: current.laneTitle }];
  }
  const sameCard = previous.card === current.card;
  const samePlace = previous.laneTitle === current.laneTitle;
  if (sameCard && samePlace) {
    return [];
  }
  return changesOf({ before: previous, after: current, titles, boards, at });
}

/** Os cards que ganharam registro no histórico, pelo id. */
type UpdatedCards = ReadonlyMap<string, BoardCard>;

interface LaneUpdate {
  readonly lane: BoardLane;
  readonly updated: UpdatedCards;
}

/** A coluna com os cards atualizados; sem nenhum deles, a própria coluna. */
function laneWithUpdated(params: LaneUpdate): BoardLane {
  const { lane, updated } = params;
  const hasUpdated = lane.cards.some((card) => updated.has(card.id));
  if (!hasUpdated) {
    return lane;
  }
  const cards = lane.cards.map((card) => updated.get(card.id) ?? card);
  return { ...lane, cards };
}

interface ArchiveEntryUpdate {
  readonly entry: ArchiveEntry;
  readonly updated: UpdatedCards;
}

function hasUpdatedCard(params: ArchiveEntryUpdate): boolean {
  const { entry, updated } = params;
  return entry.cards.some((item) => updated.has(item.card.id));
}

/** O arquivamento com os cards atualizados; sem nenhum deles, o próprio arquivamento. */
function entryWithUpdated(params: ArchiveEntryUpdate): ArchiveEntry {
  const { entry, updated } = params;
  if (!hasUpdatedCard(params)) {
    return entry;
  }
  const cards = entry.cards.map((item) => ({
    ...item,
    card: updated.get(item.card.id) ?? item.card,
  }));
  return { ...entry, cards };
}

interface BoardUpdate {
  readonly board: Board;
  readonly updated: UpdatedCards;
}

/** Troca no quadro os cards que ganharam registro, nas colunas e no arquivo. */
function boardWithUpdated(params: BoardUpdate): Board {
  const { board, updated } = params;
  const lanes = board.lanes.map((lane) => laneWithUpdated({ lane, updated }));
  const archiveChanged = board.archive.some((entry) =>
    hasUpdatedCard({ entry, updated }),
  );
  // NOTE: sem card arquivado mudando, o arquivo continua o mesmo objeto; o desfazer compara por referência.
  let archive = board.archive;
  if (archiveChanged) {
    archive = board.archive.map((entry) =>
      entryWithUpdated({ entry, updated }),
    );
  }
  return { ...board, lanes, archive };
}

export interface WithActivityParams {
  readonly before: Board;
  readonly after: Board;
  readonly at: string;
  readonly merge: boolean;
}

/**
 * Registra no histórico de cada card o que mudou de `before` para `after`. Card novo ganha "criado", a menos que já
 * chegue com histórico (a cópia de uma duplicação); card que sumiu de vez não registra nada.
 */
export function withActivity(params: WithActivityParams): Board {
  const { before, after, at, merge } = params;
  if (before === after) {
    return after;
  }
  const titles = { before: placements(before), after: placements(after) };
  const boards = { before, after };
  const updated = new Map<string, BoardCard>();

  for (const [id, current] of titles.after) {
    const previous = titles.before.get(id);
    const entries = entriesFor({ previous, current, titles, boards, at });
    if (entries.length === 0) {
      continue;
    }
    const activity = appendActivity({
      list: current.card.activity ?? [],
      entries,
      merge,
    });
    updated.set(id, {
      ...current.card,
      activity: activity.length > 0 ? activity : undefined,
    });
  }

  if (updated.size === 0) {
    return after;
  }
  return boardWithUpdated({ board: after, updated });
}

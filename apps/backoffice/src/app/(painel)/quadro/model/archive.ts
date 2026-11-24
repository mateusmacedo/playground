import {
  type ArchivedCard,
  allCards,
  type Board,
  type BoardCard,
  type BoardLane,
} from './board';
import { descendantIds } from './hierarchy';

export interface ArchiveCardParams {
  readonly board: Board;
  readonly cardId: string;
  readonly at: string;
}

/**
 * Arquiva o card junto com os descendentes: todos saem das colunas e voltam juntos, então a hierarquia entre eles não
 * se perde. Card inexistente devolve o próprio `board`.
 */
export function archiveCard(params: ArchiveCardParams): Board {
  const { board, cardId, at } = params;
  const ids = new Set([
    cardId,
    ...descendantIds({ lanes: board.lanes, cardId }),
  ]);
  const archived: ArchivedCard[] = [];
  for (const lane of board.lanes) {
    for (const card of lane.cards) {
      if (ids.has(card.id)) {
        archived.push({ card, laneId: lane.id });
      }
    }
  }
  const root = archived.find(({ card }) => card.id === cardId);
  if (!root) {
    return board;
  }
  const cards = [root, ...archived.filter((item) => item !== root)];
  const lanes = board.lanes.map((lane) => withoutCards({ lane, ids }));
  const entry = { id: cardId, archivedAt: at, cards };
  return { ...board, lanes, archive: [entry, ...board.archive] };
}

interface WithoutCardsParams {
  readonly lane: BoardLane;
  /** Ids dos cards que saem da coluna. */
  readonly ids: ReadonlySet<string>;
}

/** A coluna sem os cards dos ids dados; sem nenhum deles, a própria coluna. */
function withoutCards(params: WithoutCardsParams): BoardLane {
  const { lane, ids } = params;
  const hasAny = lane.cards.some((card) => ids.has(card.id));
  if (!hasAny) {
    return lane;
  }
  return { ...lane, cards: lane.cards.filter((card) => !ids.has(card.id)) };
}

export interface RestoreArchivedParams {
  readonly board: Board;
  readonly entryId: string;
}

/**
 * Devolve o arquivamento ao quadro, cada card no fim da coluna de onde saiu (ou da primeira, se ela sumiu). O pai que
 * não existe mais e as etiquetas que saíram do catálogo são soltos.
 */
export function restoreArchived(params: RestoreArchivedParams): Board {
  const { board, entryId } = params;
  const entry = board.archive.find((candidate) => candidate.id === entryId);
  const fallback = board.lanes[0];
  if (!entry || !fallback) {
    return board;
  }
  const liveIds = new Set([
    ...allCards(board.lanes).map((card) => card.id),
    ...entry.cards.map(({ card }) => card.id),
  ]);
  const labelIds = new Set(board.labels.map((label) => label.id));
  const sanitize = (card: BoardCard): BoardCard => {
    const parentId =
      card.parentId && liveIds.has(card.parentId) ? card.parentId : undefined;
    const labels = card.labelIds?.filter((id) => labelIds.has(id));
    return {
      ...card,
      parentId,
      labelIds: labels && labels.length > 0 ? labels : undefined,
    };
  };
  const incoming = new Map<string, BoardCard[]>();
  for (const { card, laneId } of entry.cards) {
    const lane = board.lanes.some((candidate) => candidate.id === laneId)
      ? laneId
      : fallback.id;
    incoming.set(lane, [...(incoming.get(lane) ?? []), sanitize(card)]);
  }
  return {
    ...board,
    lanes: board.lanes.map((lane) => {
      const cards = incoming.get(lane.id);
      return cards ? { ...lane, cards: [...lane.cards, ...cards] } : lane;
    }),
    archive: board.archive.filter((candidate) => candidate !== entry),
  };
}

export interface DeleteArchivedParams {
  readonly board: Board;
  readonly entryId: string;
}

/** Exclui de vez o arquivamento e todos os cards dele. */
export function deleteArchived(params: DeleteArchivedParams): Board {
  const { board, entryId } = params;
  const archive = board.archive.filter((entry) => entry.id !== entryId);
  return archive.length === board.archive.length
    ? board
    : { ...board, archive };
}

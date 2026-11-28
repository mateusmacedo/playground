import {
  allCards,
  type Board,
  type BoardCard,
  type BoardLane,
  findCard,
  updateCardIn,
} from './board';
import { doneLaneOf } from './done-lane';
import { mapCards } from './map-cards';
import { CARD_MISSING, type ProcessChange, refusedChange } from './process-run';

export const SELF_BLOCK = 'Um card não pode bloquear a si mesmo.';
export const BLOCKER_MISSING = 'O card bloqueador não está mais no quadro.';

export interface CycleRefusalParams {
  readonly card: BoardCard;
  readonly blocker: BoardCard;
}

/** Recusa da dependência que fecharia um ciclo, com os dois cards pelo título. */
export function cycleRefusal(params: CycleRefusalParams): string {
  return `O card ${params.blocker.title} já depende de ${params.card.title}: a dependência fecharia um ciclo.`;
}

export interface CardInLanesParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}

/** Cards das colunas que bloqueiam o card, na ordem da tela. */
export function blockersOf(params: CardInLanesParams): readonly BoardCard[] {
  const card = findCard(params)?.card;
  const ids = new Set(card?.blockedBy);
  return allCards(params.lanes).filter((candidate) => ids.has(candidate.id));
}

/** Cards das colunas que o card bloqueia (o "Bloqueia" do painel), na ordem da tela. */
export function blockedCardsOf(
  params: CardInLanesParams,
): readonly BoardCard[] {
  return allCards(params.lanes).filter((candidate) =>
    candidate.blockedBy?.includes(params.cardId),
  );
}

export interface DependsOnParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  /** Card que talvez bloqueie `cardId`, direta ou indiretamente. */
  readonly targetId: string;
}

/** Diz se `targetId` bloqueia `cardId`, direto ou por uma cadeia de bloqueadores. */
export function dependsOn(params: DependsOnParams): boolean {
  const { lanes, cardId, targetId } = params;
  const visited = new Set<string>();
  const pending = [cardId];
  for (let current = pending.pop(); current; current = pending.pop()) {
    const blockers = findCard({ lanes, cardId: current })?.card.blockedBy ?? [];
    for (const blockerId of blockers) {
      if (blockerId === targetId) {
        return true;
      }
      if (!visited.has(blockerId)) {
        visited.add(blockerId);
        pending.push(blockerId);
      }
    }
  }
  return false;
}

/** Cards que podem passar a bloquear o card: todos os das colunas, menos ele, os que já bloqueiam e os que fechariam um ciclo. */
export function blockerCandidates(
  params: CardInLanesParams,
): readonly BoardCard[] {
  const { lanes, cardId } = params;
  const current = new Set(findCard(params)?.card.blockedBy);
  return allCards(lanes).filter(
    (candidate) =>
      candidate.id !== cardId &&
      !current.has(candidate.id) &&
      !dependsOn({ lanes, cardId: candidate.id, targetId: cardId }),
  );
}

export interface BlockerChangeParams {
  readonly board: Board;
  /** Card bloqueado. */
  readonly cardId: string;
  readonly blockerId: string;
}

/**
 * Faz `blockerId` bloquear o card. Recusa o próprio card, o card que não está nas colunas e a dependência que fecharia
 * um ciclo; o bloqueador que já estava na lista devolve o próprio quadro.
 */
export function addBlocker(params: BlockerChangeParams): ProcessChange {
  const { board, cardId, blockerId } = params;
  const { lanes } = board;
  const card = findCard({ lanes, cardId })?.card;
  if (!card) {
    return refusedChange(CARD_MISSING);
  }
  if (blockerId === cardId) {
    return refusedChange(SELF_BLOCK);
  }
  const blocker = findCard({ lanes, cardId: blockerId })?.card;
  if (!blocker) {
    return refusedChange(BLOCKER_MISSING);
  }
  if (card.blockedBy?.includes(blockerId)) {
    return { ok: true, board };
  }
  if (dependsOn({ lanes, cardId: blockerId, targetId: cardId })) {
    return refusedChange(cycleRefusal({ card, blocker }));
  }
  const blockedBy = [...(card.blockedBy ?? []), blockerId];
  const nextLanes = updateCardIn({
    lanes,
    cardId,
    update: (current) => ({ ...current, blockedBy }),
  });
  return { ok: true, board: { ...board, lanes: nextLanes } };
}

/** Tira `blockerId` dos bloqueadores do card; sem ele na lista, devolve o próprio quadro. */
export function removeBlocker(params: BlockerChangeParams): Board {
  const { board, cardId, blockerId } = params;
  const lanes = updateCardIn({
    lanes: board.lanes,
    cardId,
    update: (card) => {
      if (!card.blockedBy?.includes(blockerId)) {
        return card;
      }
      const blockedBy = card.blockedBy.filter((id) => id !== blockerId);
      return {
        ...card,
        blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
      };
    },
  });
  return lanes === board.lanes ? board : { ...board, lanes };
}

export interface PendingBlockersParams {
  readonly board: Board;
  readonly cardId: string;
}

/**
 * Bloqueadores do card que ainda não estão na coluna de conclusão; sem coluna de conclusão, todos. Com algum, o card
 * está bloqueado.
 */
export function pendingBlockers(
  params: PendingBlockersParams,
): readonly BoardCard[] {
  const { board, cardId } = params;
  const done = doneLaneOf(board);
  const concluded = new Set(done?.cards.map((card) => card.id));
  return blockersOf({ lanes: board.lanes, cardId }).filter(
    (blocker) => !concluded.has(blocker.id),
  );
}

/**
 * Ids dos cards das colunas com algum bloqueador fora da coluna de conclusão, calculados de uma vez para as visões
 * marcarem cada card com o selo "Bloqueado".
 */
export function blockedCardIds(board: Board): ReadonlySet<string> {
  const cards = allCards(board.lanes);
  const liveIds = new Set(cards.map((card) => card.id));
  const concluded = new Set(doneLaneOf(board)?.cards.map((card) => card.id));
  const blocked = new Set<string>();
  for (const card of cards) {
    const pending = card.blockedBy?.some(
      (blockerId) => liveIds.has(blockerId) && !concluded.has(blockerId),
    );
    if (pending) {
      blocked.add(card.id);
    }
  }
  return blocked;
}

export interface KnownBlockersParams {
  readonly card: BoardCard;
  /** Ids dos cards que estão nas colunas. */
  readonly liveIds: ReadonlySet<string>;
}

/** O card só com os bloqueadores que estão nas colunas; ele próprio não se bloqueia. */
export function withKnownBlockers(params: KnownBlockersParams): BoardCard {
  const { card, liveIds } = params;
  if (!card.blockedBy) {
    return card;
  }
  const blockedBy = card.blockedBy.filter(
    (id) => id !== card.id && liveIds.has(id),
  );
  if (blockedBy.length === card.blockedBy.length) {
    return card;
  }
  return { ...card, blockedBy: blockedBy.length > 0 ? blockedBy : undefined };
}

/**
 * Tira dos cards das colunas o bloqueador que saiu delas, excluído ou arquivado. O card arquivado guarda os
 * bloqueadores dele, e restaurar um bloqueador não o devolve a quem ele bloqueava. Sem nada a tirar, o próprio quadro.
 */
export function pruneBlockers(board: Board): Board {
  const liveIds = new Set(allCards(board.lanes).map((card) => card.id));
  const lanes = mapCards({
    lanes: board.lanes,
    update: (card) => withKnownBlockers({ card, liveIds }),
  });
  return lanes === board.lanes ? board : { ...board, lanes };
}

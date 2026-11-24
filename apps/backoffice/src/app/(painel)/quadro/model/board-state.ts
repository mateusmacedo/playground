import {
  type ArchiveEntry,
  allCards,
  type Board,
  type BoardCard,
  type BoardConfig,
  type BoardLabel,
  type BoardLane,
} from './board';
import { DEFAULT_CONFIG } from './config';

function cardsIn(archive: readonly ArchiveEntry[]): readonly BoardCard[] {
  const cards: BoardCard[] = [];
  for (const entry of archive) {
    for (const item of entry.cards) {
      cards.push(item.card);
    }
  }
  return cards;
}

/** Cards arquivados, na ordem do arquivo. */
export function archivedCards(board: Board): readonly BoardCard[] {
  return cardsIn(board.archive);
}

/** Maior número já dado a um card; `0` quando nenhum tem número. */
function highestNumber(cards: readonly BoardCard[]): number {
  let highest = 0;
  for (const card of cards) {
    if (card.number !== undefined && card.number > highest) {
      highest = card.number;
    }
  }
  return highest;
}

export interface CreateBoardParams {
  readonly lanes: readonly BoardLane[];
  readonly labels?: readonly BoardLabel[];
  readonly archive?: readonly ArchiveEntry[];
  readonly nextNumber?: number;
  readonly config?: BoardConfig;
}

/**
 * Monta o quadro a partir das colunas, com ou sem número nos cards. Quem não tem número ganha o próximo livre, na
 * ordem da tela, e o próximo número fica sempre acima de todos os que já existem.
 */
export function createBoard(params: CreateBoardParams): Board {
  const archive = params.archive ?? [];
  const labels = params.labels ?? [];
  const existing = [...allCards(params.lanes), ...cardsIn(archive)];
  const firstFree = highestNumber(existing) + 1;

  let nextNumber = Math.max(params.nextNumber ?? 1, firstFree);
  const lanes: BoardLane[] = [];
  for (const lane of params.lanes) {
    const allNumbered = lane.cards.every((card) => card.number !== undefined);
    if (allNumbered) {
      lanes.push(lane);
      continue;
    }
    const cards: BoardCard[] = [];
    for (const card of lane.cards) {
      if (card.number !== undefined) {
        cards.push(card);
        continue;
      }
      cards.push({ ...card, number: nextNumber });
      nextNumber += 1;
    }
    lanes.push({ ...lane, cards });
  }

  return {
    lanes,
    archive,
    labels,
    nextNumber,
    config: params.config ?? DEFAULT_CONFIG,
  };
}

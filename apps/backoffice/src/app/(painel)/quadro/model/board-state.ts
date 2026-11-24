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

/** Cards arquivados, na ordem do arquivo. */
export function archivedCards(board: Board): readonly BoardCard[] {
  return board.archive.flatMap((entry) => entry.cards.map(({ card }) => card));
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
  const existing = [
    ...allCards(params.lanes),
    ...archive.flatMap((entry) => entry.cards.map(({ card }) => card)),
  ].map((card) => card.number ?? 0);
  let nextNumber = Math.max(
    params.nextNumber ?? 1,
    Math.max(0, ...existing) + 1,
  );
  const numbered = (card: BoardCard): BoardCard => {
    if (card.number !== undefined) {
      return card;
    }
    const withNumber = { ...card, number: nextNumber };
    nextNumber += 1;
    return withNumber;
  };
  const lanes = params.lanes.map((lane) =>
    lane.cards.every((card) => card.number !== undefined)
      ? lane
      : { ...lane, cards: lane.cards.map(numbered) },
  );
  return {
    lanes,
    archive,
    labels,
    nextNumber,
    config: params.config ?? DEFAULT_CONFIG,
  };
}

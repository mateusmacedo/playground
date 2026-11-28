import {
  type ArchiveEntry,
  allCards,
  type Board,
  type BoardCard,
} from './board';
import { planFor, pruneProcesses } from './board-processes';
import { archivedCards } from './board-state';
import { withKnownBlockers } from './dependencies';
import { mapCards } from './map-cards';
import { syncStepLinks } from './step-links';

interface CardInBoard {
  readonly board: Board;
  readonly card: BoardCard;
}

function lacksPlan(params: CardInBoard): boolean {
  const { board, card } = params;
  return (
    card.process !== undefined &&
    planFor({ board, run: card.process }) === undefined
  );
}

/** O card sem a execução cujo roteiro o quadro não tem: sem roteiro não dá para saber onde ela está nem avançá-la. */
function withKnownPlan(params: CardInBoard): BoardCard {
  return lacksPlan(params)
    ? { ...params.card, process: undefined }
    : params.card;
}

/** O arquivo sem as execuções que ficaram sem roteiro; sem nenhuma, o próprio arquivo. */
function archiveWithKnownPlans(board: Board): readonly ArchiveEntry[] {
  const broken = archivedCards(board).some((card) =>
    lacksPlan({ board, card }),
  );
  if (!broken) {
    return board.archive;
  }
  return board.archive.map((entry) => ({
    ...entry,
    cards: entry.cards.map((item) => ({
      ...item,
      card: withKnownPlan({ board, card: item.card }),
    })),
  }));
}

/**
 * Acerta o que o quadro gravado diz de processos e dependências, que pode ter sido gravado pela metade ou mexido à
 * mão: saem a execução sem roteiro, o bloqueador que não está nas colunas, a ligação de etapa que não fecha dos dois
 * lados e o roteiro que nenhum card usa. O quadro sem nada disso volta como veio.
 */
export function withConsistentProcesses(board: Board): Board {
  const liveIds = new Set(allCards(board.lanes).map((card) => card.id));
  const lanes = mapCards({
    lanes: board.lanes,
    update: (card) =>
      withKnownBlockers({ card: withKnownPlan({ board, card }), liveIds }),
  });
  const archive = archiveWithKnownPlans(board);
  const untouched = lanes === board.lanes && archive === board.archive;
  const cleaned = untouched ? board : { ...board, lanes, archive };
  return pruneProcesses(syncStepLinks(cleaned));
}

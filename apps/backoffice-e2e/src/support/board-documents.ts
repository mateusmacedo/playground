import type { BoardCard, BoardLane, BoardSeed } from './mock-documents';
import type { MockServer } from './mock-server';

/** O quadro que o painel abre quando o endereço não pede outro. */
export const MAIN_BOARD_ID = 'board-1';
const MAIN_BOARD_NAME = 'Quadro principal';
// NOTE: a versão do formato do quadro no contrato (`schemaVersion` de `BoardDocument`).
const BOARD_SCHEMA_VERSION = 3;
const KEY_PREFIX = 'QD';

export interface LaneCards {
  readonly id: string;
  readonly title: string;
  /** Títulos dos cards, na ordem da coluna. */
  readonly cards: readonly string[];
}

export interface BoardOfParams {
  readonly lanes: readonly LaneCards[];
  /** Sem `id` e `name`, o quadro semeado é o principal. */
  readonly id?: string;
  readonly name?: string;
}

/** Monta um quadro só com colunas e cards de título, numerados na ordem em que aparecem (`QD-1`, `QD-2`...). */
export function boardOf({
  lanes,
  id = MAIN_BOARD_ID,
  name = MAIN_BOARD_NAME,
}: BoardOfParams): BoardSeed {
  let lastNumber = 0;
  const numbered: BoardLane[] = [];
  for (const column of lanes) {
    const cards: BoardCard[] = [];
    for (const title of column.cards) {
      lastNumber += 1;
      cards.push({ id: `card-${lastNumber}`, title, number: lastNumber });
    }
    numbered.push({ id: column.id, title: column.title, cards });
  }
  return {
    id,
    name,
    schemaVersion: BOARD_SCHEMA_VERSION,
    board: {
      lanes: numbered,
      archive: [],
      labels: [],
      nextNumber: lastNumber + 1,
      config: { keyPrefix: KEY_PREFIX },
    },
  };
}

export interface WithCardParams {
  readonly seed: BoardSeed;
  readonly laneId: string;
  readonly title: string;
}

/** O mesmo quadro com um card a mais no fim da coluna: é a mudança que "outra pessoa" grava num teste de conflito. */
export function withCard({ seed, laneId, title }: WithCardParams): BoardSeed {
  const { board } = seed;
  const added: BoardCard = {
    id: `card-${board.nextNumber}`,
    title,
    number: board.nextNumber,
  };
  const lanes = board.lanes.map((column) =>
    column.id === laneId
      ? { ...column, cards: [...column.cards, added] }
      : column,
  );
  return {
    ...seed,
    board: { ...board, lanes, nextNumber: board.nextNumber + 1 },
  };
}

export interface SavedCardsParams {
  readonly mock: MockServer;
  readonly laneTitle: string;
  readonly boardId?: string;
}

/**
 * Os títulos dos cards de uma coluna como estão gravados no mock. Use com `expect.poll` para esperar a gravação do
 * painel, que sai cerca de 400 ms depois da última mudança.
 */
export async function savedCardTitles({
  mock,
  laneTitle,
  boardId = MAIN_BOARD_ID,
}: SavedCardsParams): Promise<readonly string[]> {
  const stored = await mock.readBoard(boardId);
  if (stored === null) {
    return [];
  }
  const column = stored.board.lanes.find((item) => item.title === laneTitle);
  if (column === undefined) {
    return [];
  }
  return column.cards.map((item) => item.title);
}

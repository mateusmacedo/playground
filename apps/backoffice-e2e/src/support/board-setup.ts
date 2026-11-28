import { MAIN_BOARD_ID } from './board-documents';
import type { BoardCard, BoardSeed, Json, JsonObject } from './mock-documents';
import type { MockServer } from './mock-server';

/** As regras opcionais do quadro, como o contrato as nomeia em `config.rules`. */
export type BoardRule =
  | 'parentWaitsChildren'
  | 'parentFollowsChildren'
  | 'doneWaitsProcess'
  | 'processEndMovesCard'
  | 'doneWaitsBlockers'
  | 'childInherits';

const ALL_RULES: readonly BoardRule[] = [
  'parentWaitsChildren',
  'parentFollowsChildren',
  'doneWaitsProcess',
  'processEndMovesCard',
  'doneWaitsBlockers',
  'childInherits',
];

export interface WithDoneLaneParams {
  readonly seed: BoardSeed;
  readonly laneId: string;
  /** As regras ligadas; as outras ficam desligadas. */
  readonly rules?: readonly BoardRule[];
}

/** O mesmo quadro com a coluna de conclusão escolhida e as regras pedidas ligadas. */
export function withDoneLane({
  seed,
  laneId,
  rules = [],
}: WithDoneLaneParams): BoardSeed {
  const flags: Record<string, boolean> = {};
  for (const rule of ALL_RULES) {
    flags[rule] = rules.includes(rule);
  }
  const config = { ...seed.board.config, doneLaneId: laneId, rules: flags };
  return { ...seed, board: { ...seed.board, config } };
}

export interface WithCardFieldsParams {
  readonly seed: BoardSeed;
  readonly cardId: string;
  /** Os campos que entram no card, por cima dos que ele já tem (`parentId`, `blockedBy`...). */
  readonly fields: JsonObject;
}

/** O mesmo quadro com campos a mais num card, como a relação com o pai ou os bloqueadores. */
export function withCardFields({
  seed,
  cardId,
  fields,
}: WithCardFieldsParams): BoardSeed {
  const lanes = seed.board.lanes.map((column) => ({
    ...column,
    cards: column.cards.map(
      (item): BoardCard => (item.id === cardId ? { ...item, ...fields } : item),
    ),
  }));
  return { ...seed, board: { ...seed.board, lanes } };
}

export interface MoveCardParams {
  readonly seed: BoardSeed;
  readonly cardId: string;
  readonly laneId: string;
}

/** O mesmo quadro com o card no fim de outra coluna. */
export function withCardMoved({
  seed,
  cardId,
  laneId,
}: MoveCardParams): BoardSeed {
  const moved = seed.board.lanes
    .flatMap((column) => column.cards)
    .find((item) => item.id === cardId);
  if (moved === undefined) {
    throw new Error(`O quadro semeado não tem o card ${cardId}.`);
  }
  const lanes = seed.board.lanes.map((column) => {
    const others = column.cards.filter((item) => item.id !== cardId);
    return {
      ...column,
      cards: column.id === laneId ? [...others, moved] : others,
    };
  });
  return { ...seed, board: { ...seed.board, lanes } };
}

export interface SavedCardParams {
  readonly mock: MockServer;
  readonly cardId: string;
  readonly boardId?: string;
}

/** O card como está gravado no mock, em qualquer coluna; `undefined` quando o quadro ou o card não existe. */
export async function savedCard({
  mock,
  cardId,
  boardId = MAIN_BOARD_ID,
}: SavedCardParams): Promise<BoardCard | undefined> {
  const stored = await mock.readBoard(boardId);
  if (stored === null) {
    return undefined;
  }
  return stored.board.lanes
    .flatMap((column) => column.cards)
    .find((item) => item.id === cardId);
}

/**
 * A situação do processo do card como está gravada no mock (`running`, `completed`, `cancelled`), ou `undefined` sem
 * processo. Use com `expect.poll` antes de sair do quadro ou de recarregar a página.
 */
export async function savedProcessStatus(
  params: SavedCardParams,
): Promise<string | undefined> {
  const stored = await savedCard(params);
  const process = stored?.process;
  if (!isJsonObject(process)) {
    return undefined;
  }
  return typeof process.status === 'string' ? process.status : undefined;
}

function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

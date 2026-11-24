import { allCards, type BoardCard, type BoardLane } from './board';
import { ancestorsOf } from './hierarchy';

/** Chave do quadro no `localStorage`; o sufixo acompanha a versão do formato gravado. */
export const BOARD_STORAGE_KEY = 'backoffice:quadro:v1';

const BOARD_VERSION = 1;

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function toCard(value: unknown): BoardCard | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    !isOptionalString(value.description) ||
    !isOptionalString(value.parentId)
  ) {
    return null;
  }
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    parentId: value.parentId,
  };
}

function toLane(value: unknown): BoardLane | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    !Array.isArray(value.cards)
  ) {
    return null;
  }
  const { wipLimit } = value;
  if (
    wipLimit !== undefined &&
    !(
      typeof wipLimit === 'number' &&
      Number.isInteger(wipLimit) &&
      wipLimit > 0
    )
  ) {
    return null;
  }
  const cards = value.cards.map(toCard);
  if (cards.some((card) => card === null)) {
    return null;
  }
  return {
    id: value.id,
    title: value.title,
    cards: cards as BoardCard[],
    wipLimit,
  };
}

/** Ids únicos, pais que existem e nenhum ciclo na hierarquia. */
function isConsistent(lanes: readonly BoardLane[]): boolean {
  const cards = allCards(lanes);
  const cardIds = new Set(cards.map((card) => card.id));
  const laneIds = new Set(lanes.map((lane) => lane.id));
  if (cardIds.size !== cards.length || laneIds.size !== lanes.length) {
    return false;
  }
  return cards.every((card) => {
    if (card.parentId === undefined) {
      return true;
    }
    if (!cardIds.has(card.parentId)) {
      return false;
    }
    const ancestors = ancestorsOf({ lanes, cardId: card.id });
    const root = ancestors.at(-1);
    // NOTE: o `ancestorsOf` para num ciclo; numa cadeia válida, a raiz não tem pai.
    return root !== undefined && root.parentId === undefined;
  });
}

export function serializeBoard(lanes: readonly BoardLane[]): string {
  return JSON.stringify({ version: BOARD_VERSION, lanes });
}

/**
 * Lê o quadro gravado. Devolve `null` quando não há nada, quando o JSON é inválido ou de outra versão, ou quando o
 * conteúdo não forma um quadro coerente; quem chama continua com o quadro que já tem.
 */
export function parseStoredBoard(
  raw: string | null,
): readonly BoardLane[] | null {
  if (!raw) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isRecord(data) ||
    data.version !== BOARD_VERSION ||
    !Array.isArray(data.lanes)
  ) {
    return null;
  }
  const lanes = data.lanes.map(toLane);
  if (lanes.length === 0 || lanes.some((lane) => lane === null)) {
    return null;
  }
  const board = lanes as BoardLane[];
  return isConsistent(board) ? board : null;
}

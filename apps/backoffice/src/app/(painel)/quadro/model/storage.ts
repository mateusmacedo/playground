import { allCards, type Board, type BoardCard } from './board';
import { archivedCards, createBoard } from './board-state';
import { ancestorsOf } from './hierarchy';
import { setPeople } from './people';
import {
  isPositiveInteger,
  isRecord,
  keepValid,
  toArchiveEntry,
  toConfig,
  toLabel,
  toLanes,
  type UnknownRecord,
} from './stored-items';

/** Chave do quadro no `localStorage`; a versão do formato vai dentro do valor gravado. */
export const BOARD_STORAGE_KEY = 'backoffice:quadro:v1';

const BOARD_VERSION = 3;

/** Ids e números únicos, pais que existem no quadro e nenhum ciclo na hierarquia das colunas. */
function isConsistent(board: Board): boolean {
  const live = allCards(board.lanes);
  const every = [...live, ...archivedCards(board)];
  const ids = new Set(every.map((card) => card.id));
  const numbers = new Set(every.map((card) => card.number));
  const laneIds = new Set(board.lanes.map((lane) => lane.id));
  if (
    ids.size !== every.length ||
    numbers.size !== every.length ||
    laneIds.size !== board.lanes.length
  ) {
    return false;
  }
  const liveIds = new Set(live.map((card) => card.id));
  return live.every((card) => {
    if (card.parentId === undefined) {
      return true;
    }
    if (!liveIds.has(card.parentId)) {
      return false;
    }
    const root = ancestorsOf({ lanes: board.lanes, cardId: card.id }).at(-1);
    // NOTE: o `ancestorsOf` para num ciclo; numa cadeia válida, a raiz não tem pai.
    return root !== undefined && root.parentId === undefined;
  });
}

/** Tira dos cards as etiquetas que não estão no catálogo. */
function withKnownLabels(board: Board): Board {
  const known = new Set(board.labels.map((label) => label.id));
  const clean = (card: BoardCard): BoardCard => {
    if (!card.labelIds?.some((id) => !known.has(id))) {
      return card;
    }
    const labelIds = card.labelIds.filter((id) => known.has(id));
    return { ...card, labelIds: labelIds.length > 0 ? labelIds : undefined };
  };
  return {
    ...board,
    lanes: board.lanes.map((lane) => ({
      ...lane,
      cards: lane.cards.map(clean),
    })),
    archive: board.archive.map((entry) => ({
      ...entry,
      cards: entry.cards.map((item) => ({ ...item, card: clean(item.card) })),
    })),
  };
}

/** Tira da configuração a coluna de conclusão que não existe e dos cards o responsável que não está no quadro. */
function withKnownReferences(board: Board): Board {
  const { doneLaneId } = board.config;
  const config =
    doneLaneId && !board.lanes.some((lane) => lane.id === doneLaneId)
      ? { ...board.config, doneLaneId: undefined }
      : board.config;
  return setPeople({
    board: { ...board, config },
    people: board.config.people ?? [],
  });
}

/** Versões 2 e 3: a 3 só acrescentou a configuração, que na 2 fica com o padrão. */
function fromVersion2(data: UnknownRecord): Board | null {
  const stored = data.board;
  if (!isRecord(stored)) {
    return null;
  }
  const lanes = toLanes(stored.lanes);
  if (!lanes) {
    return null;
  }
  return withKnownReferences(
    withKnownLabels(
      createBoard({
        lanes,
        labels: keepValid({ value: stored.labels, parse: toLabel }) ?? [],
        archive:
          keepValid({ value: stored.archive, parse: toArchiveEntry }) ?? [],
        nextNumber: isPositiveInteger(stored.nextNumber)
          ? stored.nextNumber
          : undefined,
        config: toConfig(stored.config),
      }),
    ),
  );
}

export function serializeBoard(board: Board): string {
  return JSON.stringify({ version: BOARD_VERSION, board });
}

/**
 * Lê o quadro gravado, na versão atual, na 2 (sem configuração) ou na 1 (só colunas, que ganham os números dos cards na ordem da tela). Devolve
 * `null` quando não há nada, quando o JSON é inválido ou de versão desconhecida, ou quando o conteúdo não forma um
 * quadro coerente; quem chama continua com o quadro que já tem.
 */
export function parseStoredBoard(raw: string | null): Board | null {
  if (!raw) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) {
    return null;
  }
  let board: Board | null = null;
  if (data.version === 1) {
    const lanes = toLanes(data.lanes);
    board = lanes ? createBoard({ lanes }) : null;
  } else if (data.version === 2 || data.version === BOARD_VERSION) {
    board = fromVersion2(data);
  }
  return board && isConsistent(board) ? board : null;
}

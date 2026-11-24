import { isWebLink } from './attachments';
import {
  type ArchiveEntry,
  allCards,
  type Board,
  type BoardCard,
  type BoardConfig,
  type BoardLabel,
  type BoardLane,
  type BoardPerson,
  type CardActivity,
  type CardAttachment,
  type CardComment,
  type ChecklistItem,
  type LabelColor,
} from './board';
import { archivedCards, createBoard } from './board-state';
import { DEFAULT_CONFIG, isValidKeyPrefix } from './config';
import { isDateOnly } from './due';
import { ancestorsOf } from './hierarchy';
import { setPeople } from './people';

/** Chave do quadro no `localStorage`; a versão do formato vai dentro do valor gravado. */
export const BOARD_STORAGE_KEY = 'backoffice:quadro:v1';

const BOARD_VERSION = 3;

const LABEL_COLORS: readonly LabelColor[] = [
  'danger',
  'warning',
  'success',
  'info',
  'primary',
  'secondary',
];

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Valor lido do armazenamento, que deveria ser uma lista, e como ler cada item dela. */
interface StoredList<T> {
  readonly value: unknown;
  readonly parse: (item: unknown) => T | null;
}

/** Mantém só os itens que passam em `parse`; um item estragado não derruba o resto. */
function keepValid<T>(params: StoredList<T>): T[] | undefined {
  const { value, parse } = params;
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.map(parse).filter((item): item is T => item !== null);
  return items.length > 0 ? items : undefined;
}

function toChecklistItem(value: unknown): ChecklistItem | null {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.done === 'boolean'
    ? { id: value.id, text: value.text, done: value.done }
    : null;
}

function toComment(value: unknown): CardComment | null {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.at === 'string' &&
    typeof value.author === 'string' &&
    typeof value.text === 'string'
    ? { id: value.id, at: value.at, author: value.author, text: value.text }
    : null;
}

function toAttachment(value: unknown): CardAttachment | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.url !== 'string' ||
    typeof value.at !== 'string' ||
    // SAFETY: o endereço vira `href`; só link web ou arquivo guardado, nunca `javascript:` vindo do armazenamento.
    !(isWebLink(value.url) || value.url.startsWith('data:'))
  ) {
    return null;
  }
  return {
    id: value.id,
    name: value.name,
    url: value.url,
    at: value.at,
    size: isPositiveInteger(value.size) ? value.size : undefined,
  };
}

function toPerson(value: unknown): BoardPerson | null {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.name.trim()
    ? { id: value.id, name: value.name }
    : null;
}

function toActivity(value: unknown): CardActivity | null {
  // NOTE: o histórico só é lido para exibir; basta ter data e tipo de texto.
  return isRecord(value) &&
    typeof value.at === 'string' &&
    typeof value.kind === 'string'
    ? (value as unknown as CardActivity)
    : null;
}

/** Dados opcionais do card: o que vier fora do formato é descartado, sem invalidar o card. */
function optionalCardData(value: UnknownRecord): Partial<BoardCard> {
  const dueDate =
    typeof value.dueDate === 'string' && isDateOnly(value.dueDate)
      ? value.dueDate
      : undefined;
  return {
    number: isPositiveInteger(value.number) ? value.number : undefined,
    labelIds: keepValid({
      value: value.labelIds,
      parse: (id) => (typeof id === 'string' ? id : null),
    }),
    dueDate,
    dueDone: dueDate && value.dueDone === true ? true : undefined,
    checklist: keepValid({ value: value.checklist, parse: toChecklistItem }),
    activity: keepValid({ value: value.activity, parse: toActivity }),
    assigneeId:
      typeof value.assigneeId === 'string' ? value.assigneeId : undefined,
    comments: keepValid({ value: value.comments, parse: toComment }),
    attachments: keepValid({ value: value.attachments, parse: toAttachment }),
  };
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
    ...optionalCardData(value),
  };
}

function toCards(value: unknown): BoardCard[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const cards = value.map(toCard);
  return cards.some((card) => card === null) ? null : (cards as BoardCard[]);
}

function toLane(value: unknown): BoardLane | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string'
  ) {
    return null;
  }
  const { wipLimit } = value;
  const cards = toCards(value.cards);
  if (!cards || (wipLimit !== undefined && !isPositiveInteger(wipLimit))) {
    return null;
  }
  return {
    id: value.id,
    title: value.title,
    cards,
    wipLimit,
    hidden: value.hidden === true ? true : undefined,
    locked: value.locked === true ? true : undefined,
  };
}

function toLanes(value: unknown): BoardLane[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const lanes = value.map(toLane);
  return lanes.some((lane) => lane === null) ? null : (lanes as BoardLane[]);
}

function toLabel(value: unknown): BoardLabel | null {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    LABEL_COLORS.includes(value.color as LabelColor)
    ? { id: value.id, name: value.name, color: value.color as LabelColor }
    : null;
}

function toArchiveEntry(value: unknown): ArchiveEntry | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.archivedAt !== 'string' ||
    !Array.isArray(value.cards)
  ) {
    return null;
  }
  const cards = value.cards.map((item: unknown) => {
    const card = isRecord(item) ? toCard(item.card) : null;
    return card && isRecord(item) && typeof item.laneId === 'string'
      ? { card, laneId: item.laneId }
      : null;
  });
  if (cards.length === 0 || cards.some((item) => item === null)) {
    return null;
  }
  return {
    id: value.id,
    archivedAt: value.archivedAt,
    cards: cards as ArchiveEntry['cards'],
  };
}

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

/** Configuração gravada; o que vier fora do formato volta ao padrão, sem invalidar o quadro. */
function toConfig(value: unknown): BoardConfig {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG;
  }
  const { keyPrefix } = value;
  return {
    keyPrefix:
      typeof keyPrefix === 'string' && isValidKeyPrefix(keyPrefix)
        ? keyPrefix
        : DEFAULT_CONFIG.keyPrefix,
    archiveLaneHidden: value.archiveLaneHidden === true ? true : undefined,
    people: uniquePeople(keepValid({ value: value.people, parse: toPerson })),
    doneLaneId:
      typeof value.doneLaneId === 'string' ? value.doneLaneId : undefined,
  };
}

/** Pessoas sem id repetido: a primeira com cada id fica. */
function uniquePeople(
  people: readonly BoardPerson[] | undefined,
): readonly BoardPerson[] | undefined {
  const seen = new Set<string>();
  return people?.filter((person) => {
    const fresh = !seen.has(person.id);
    seen.add(person.id);
    return fresh;
  });
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

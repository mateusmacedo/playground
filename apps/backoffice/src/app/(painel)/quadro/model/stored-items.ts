import { isWebLink } from './attachments';
import type {
  ArchiveEntry,
  BoardCard,
  BoardConfig,
  BoardLabel,
  BoardLane,
  BoardPerson,
  CardActivity,
  CardAttachment,
  CardComment,
  ChecklistItem,
  LabelColor,
} from './board';
import { DEFAULT_CONFIG, isValidKeyPrefix } from './config';
import { isDateOnly } from './due';
import { processCardData, toRules } from './stored-process';

const LABEL_COLORS: readonly LabelColor[] = [
  'danger',
  'warning',
  'success',
  'info',
  'primary',
  'secondary',
];

export type UnknownRecord = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Valor lido do armazenamento, que deveria ser uma lista, e como ler cada item dela. */
export interface StoredList<T> {
  readonly value: unknown;
  readonly parse: (item: unknown) => T | null;
}

/** Mantém só os itens que passam em `parse`; um item estragado não derruba o resto. */
export function keepValid<T>(params: StoredList<T>): T[] | undefined {
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
    ...processCardData(value),
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

export function toLanes(value: unknown): BoardLane[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const lanes = value.map(toLane);
  return lanes.some((lane) => lane === null) ? null : (lanes as BoardLane[]);
}

export function toLabel(value: unknown): BoardLabel | null {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    LABEL_COLORS.includes(value.color as LabelColor)
    ? { id: value.id, name: value.name, color: value.color as LabelColor }
    : null;
}

export function toArchiveEntry(value: unknown): ArchiveEntry | null {
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

/** Configuração gravada; o que vier fora do formato volta ao padrão, sem invalidar o quadro. */
export function toConfig(value: unknown): BoardConfig {
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
    rules: toRules(value.rules),
  };
}

/** Pessoas sem id repetido: a primeira com cada id fica. */
function uniquePeople(
  people: readonly BoardPerson[] | undefined,
): readonly BoardPerson[] | undefined {
  if (!people) {
    return undefined;
  }
  const seen = new Set<string>();
  const unique: BoardPerson[] = [];
  for (const person of people) {
    if (seen.has(person.id)) {
      continue;
    }
    seen.add(person.id);
    unique.push(person);
  }
  return unique;
}

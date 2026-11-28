/** Objeto lido do armazenamento, ainda sem formato garantido. */
export type UnknownRecord = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Texto com conteúdo: o que identifica ou nomeia algo não pode vir vazio. */
export function isFilledText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Texto opcional: o que não for texto com conteúdo fica de fora. */
export function optionalText(value: unknown): string | undefined {
  return isFilledText(value) ? value : undefined;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Contagem: inteiro a partir de zero. */
export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Instante que o `Date` consegue ler, como o ISO 8601 que o painel grava. */
export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** Valor lido do armazenamento e as opções que ele pode assumir. */
export interface KnownOptionParams<T extends string> {
  readonly value: unknown;
  readonly options: readonly T[];
}

/** O valor, quando é uma das opções conhecidas. */
export function knownOption<T extends string>(
  params: KnownOptionParams<T>,
): T | undefined {
  const { value, options } = params;
  return options.find((option) => option === value);
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
  const items: T[] = [];
  for (const item of value) {
    const parsed = parse(item);
    if (parsed !== null) {
      items.push(parsed);
    }
  }
  return items.length > 0 ? items : undefined;
}

export interface Identified {
  readonly id: string;
}

/**
 * Lista em que todo item precisa passar em `parse` e ter id único. Um item estragado ou repetido invalida a lista
 * inteira: serve para o que define o comportamento, em que perder um item mudaria o resultado em silêncio.
 */
export function allValid<T extends Identified>(
  params: StoredList<T>,
): T[] | null {
  const { value, parse } = params;
  if (!Array.isArray(value)) {
    return null;
  }
  const items: T[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    const parsed = parse(item);
    if (parsed === null || ids.has(parsed.id)) {
      return null;
    }
    ids.add(parsed.id);
    items.push(parsed);
  }
  return items;
}

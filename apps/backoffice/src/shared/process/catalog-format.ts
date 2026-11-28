import type {
  ProcessCatalog,
  ProcessDefinition,
  ProcessVersion,
} from './catalog';
import { parsePlan } from './plan-parse';
import {
  isFilledText,
  isPositiveInteger,
  isRecord,
  isTimestamp,
  keepValid,
  optionalText,
} from './stored-values';

/** Versão do formato gravado; ela vai dentro do valor, junto das definições. */
const CATALOG_VERSION = 1;

export function serializeCatalog(catalog: ProcessCatalog): string {
  return JSON.stringify({
    version: CATALOG_VERSION,
    definitions: catalog.definitions,
  });
}

interface FirstOfEachParams<T> {
  readonly items: readonly T[];
  /** O que identifica o item na lista. */
  readonly keyOf: (item: T) => string | number;
}

/** A lista sem os itens de identificação repetida: fica o primeiro de cada uma. */
function firstOfEach<T>(params: FirstOfEachParams<T>): T[] {
  const { items, keyOf } = params;
  const seen = new Set<string | number>();
  const unique: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

function toVersion(value: unknown): ProcessVersion | null {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.version) ||
    !isTimestamp(value.publishedAt) ||
    typeof value.documentText !== 'string'
  ) {
    return null;
  }
  const plan = parsePlan(value.plan);
  if (plan === null) {
    return null;
  }
  return {
    version: value.version,
    publishedAt: value.publishedAt,
    documentText: value.documentText,
    plan,
  };
}

function toVersions(value: unknown): readonly ProcessVersion[] {
  const versions = keepValid({ value, parse: toVersion }) ?? [];
  return firstOfEach({
    items: versions,
    keyOf: (version) => version.version,
  });
}

function toDefinition(value: unknown): ProcessDefinition | null {
  if (
    !isRecord(value) ||
    !isFilledText(value.id) ||
    !isFilledText(value.name) ||
    !isTimestamp(value.createdAt)
  ) {
    return null;
  }
  return {
    id: value.id,
    name: value.name.trim(),
    description: optionalText(value.description),
    createdAt: value.createdAt,
    updatedAt: isTimestamp(value.updatedAt) ? value.updatedAt : value.createdAt,
    draftText: typeof value.draftText === 'string' ? value.draftText : null,
    versions: toVersions(value.versions),
    archived: value.archived === true ? true : undefined,
  };
}

/**
 * Lê o catálogo gravado; `null` quando não há nada, o JSON é inválido, a versão é desconhecida ou falta a lista de
 * processos. O resto é lido item a item, para um item estragado não levar os outros junto: sai o processo sem id,
 * nome ou data de criação legíveis e a versão sem número, data, documento ou roteiro legíveis. De id de processo ou
 * número de versão repetido, fica o primeiro.
 */
export function parseCatalog(raw: string | null): ProcessCatalog | null {
  if (!raw) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    // WHY: catálogo corrompido não é erro do usuário; para quem chama, é o mesmo que não haver catálogo.
    return null;
  }
  if (
    !isRecord(data) ||
    data.version !== CATALOG_VERSION ||
    !Array.isArray(data.definitions)
  ) {
    return null;
  }
  const definitions =
    keepValid({ value: data.definitions, parse: toDefinition }) ?? [];
  return {
    definitions: firstOfEach({
      items: definitions,
      keyOf: (definition) => definition.id,
    }),
  };
}

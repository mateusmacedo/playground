import type { CatalogChanged, ProcessCatalog } from '@/shared/process/catalog';
import {
  createDefinition,
  publishVersion,
} from '@/shared/process/catalog-changes';

import type { Graph } from './model/blocks';
import { DOCUMENT_VERSION, type ProcessDocument } from './model/document';
import { parseDocument, serializeDocument } from './model/draft';
import { countIssues } from './model/issues';
import { compilePlan } from './model/plan-compile';
import { findIssues } from './model/validation';

/** Nome com que o rascunho da versão anterior do editor entra no catálogo. */
export const LEGACY_PROCESS_NAME = 'Meu processo';
export const SAMPLE_PROCESS_NAME = 'Processo de exemplo';

export interface SeedCatalogParams {
  readonly catalog: ProcessCatalog;
  /** Rascunho que o editor gravava antes de existir o catálogo; `null` sem ele. */
  readonly legacyDraft: string | null;
  /** Desenho do processo de exemplo. */
  readonly sample: Graph;
  /** Instante da carga (ISO 8601). */
  readonly at: string;
}

export interface CatalogSeeded extends CatalogChanged {
  /** Havia rascunho antigo, mas ele não pôde ser lido e ficou fora do catálogo. */
  readonly legacyUnreadable: boolean;
}

interface AddProcessParams {
  readonly catalog: ProcessCatalog;
  readonly at: string;
}

interface AddLegacyParams extends AddProcessParams {
  readonly text: string;
}

function withLegacyDraft(params: AddLegacyParams): ProcessCatalog {
  const { catalog, text, at } = params;
  const created = createDefinition({
    catalog,
    name: LEGACY_PROCESS_NAME,
    draftText: text,
    at,
  });
  return created.ok ? created.catalog : catalog;
}

interface AddSampleParams extends AddProcessParams {
  readonly sample: Graph;
}

/** O exemplo entra já publicado como versão 1, para o quadro ter um processo a seguir desde a primeira carga. */
function withSample(params: AddSampleParams): ProcessCatalog {
  const { catalog, sample, at } = params;
  const drawn: ProcessDocument = {
    version: DOCUMENT_VERSION,
    lanes: [],
    graph: sample,
  };
  // WHY: o texto gravado passa pela mesma leitura que o editor faz ao abrir; assim o exemplo recém-aberto sai igual
  // ao texto publicado, e não aparece como alteração por publicar.
  const document = parseDocument(serializeDocument(drawn))?.document ?? drawn;
  const text = serializeDocument(document);
  const created = createDefinition({
    catalog,
    name: SAMPLE_PROCESS_NAME,
    draftText: text,
    at,
  });
  if (!created.ok) {
    return catalog;
  }
  if (countIssues(findIssues(document.graph)).errors > 0) {
    return created.catalog;
  }
  const published = publishVersion({
    catalog: created.catalog,
    definitionId: created.definitionId,
    documentText: text,
    plan: compilePlan(document),
    at,
  });
  return published.ok ? published.catalog : created.catalog;
}

/**
 * Primeira carga do catálogo: o rascunho antigo do editor, quando existe e pode ser lido, e o processo de exemplo.
 * Catálogo que já tem processo volta como veio, então repetir a carga não duplica nada.
 */
export function seedCatalog(params: SeedCatalogParams): CatalogSeeded {
  const { catalog, legacyDraft, sample, at } = params;
  if (catalog.definitions.length > 0) {
    return { ok: true, catalog, legacyUnreadable: false };
  }
  const hasLegacy = legacyDraft !== null;
  const legacyReadable = hasLegacy && parseDocument(legacyDraft) !== null;
  const base = legacyReadable
    ? withLegacyDraft({ catalog, text: legacyDraft, at })
    : catalog;
  return {
    ok: true,
    catalog: withSample({ catalog: base, sample, at }),
    legacyUnreadable: hasLegacy && !legacyReadable,
  };
}

import {
  type CatalogChanged,
  type CatalogRefused,
  type CatalogResult,
  type CreationResult,
  findDefinition,
  latestVersion,
  type ProcessCatalog,
  type ProcessDefinition,
  type ProcessVersion,
  type PublicationResult,
} from './catalog';
import { copyName, nameRefusal } from './catalog-names';
import type { ProcessPlan } from './plan';
import { parsePlan } from './plan-parse';

const NOT_FOUND: CatalogRefused = {
  ok: false,
  refusal: {
    code: 'not-found',
    message: 'Processo não encontrado no catálogo.',
  },
};

const ID_PREFIX = 'process-';

/**
 * Próximo id no formato `process-<número>`, acima do maior número em uso. Processo não é excluído, só arquivado, então
 * um id nunca volta a ser usado.
 *
 * WHY: o `crypto.randomUUID` só existe em contexto seguro, e o painel também é aberto por HTTP pela rede local.
 */
function nextDefinitionId(catalog: ProcessCatalog): string {
  let highest = 0;
  for (const definition of catalog.definitions) {
    const suffix = definition.id.startsWith(ID_PREFIX)
      ? definition.id.slice(ID_PREFIX.length)
      : '';
    if (/^\d+$/.test(suffix)) {
      highest = Math.max(highest, Number(suffix));
    }
  }
  return `${ID_PREFIX}${highest + 1}`;
}

/** Descrição sem espaços nas pontas; vazia é o mesmo que não ter descrição. */
function tidyDescription(description: string | undefined): string | undefined {
  const text = description?.trim();
  return text === undefined || text === '' ? undefined : text;
}

interface ChangedParams {
  readonly catalog: ProcessCatalog;
  /** Definição já com a mudança. */
  readonly definition: ProcessDefinition;
  readonly at: string;
}

/** Catálogo com a definição trocada pela nova, que passa a guardar o instante da mudança. */
function changed(params: ChangedParams): CatalogChanged {
  const { catalog, at } = params;
  const definition: ProcessDefinition = { ...params.definition, updatedAt: at };
  const definitions = catalog.definitions.map((current) =>
    current.id === definition.id ? definition : current,
  );
  return { ok: true, catalog: { definitions } };
}

export interface CreateDefinitionParams {
  readonly catalog: ProcessCatalog;
  readonly name: string;
  readonly description?: string;
  /** Texto do documento com que o processo nasce; sem ele, o processo nasce sem rascunho. */
  readonly draftText?: string;
  /** Instante da criação (ISO 8601). */
  readonly at: string;
}

/** Acrescenta um processo ao catálogo, ainda sem versão publicada. */
export function createDefinition(
  params: CreateDefinitionParams,
): CreationResult {
  const { catalog, at } = params;
  const refusal = nameRefusal({ catalog, name: params.name });
  if (refusal !== undefined) {
    return { ok: false, refusal };
  }
  const definition: ProcessDefinition = {
    id: nextDefinitionId(catalog),
    name: params.name.trim(),
    description: tidyDescription(params.description),
    createdAt: at,
    updatedAt: at,
    draftText: params.draftText ?? null,
    versions: [],
  };
  return {
    ok: true,
    catalog: { definitions: [...catalog.definitions, definition] },
    definitionId: definition.id,
  };
}

/** Uma mudança num processo do catálogo. */
export interface DefinitionChangeParams {
  readonly catalog: ProcessCatalog;
  readonly definitionId: string;
  /** Instante da mudança (ISO 8601). */
  readonly at: string;
}

export interface RenameDefinitionParams extends DefinitionChangeParams {
  readonly name: string;
}

export function renameDefinition(
  params: RenameDefinitionParams,
): CatalogResult {
  const { catalog, definitionId, at } = params;
  const current = findDefinition({ catalog, definitionId });
  if (current === undefined) {
    return NOT_FOUND;
  }
  const refusal = nameRefusal({ catalog, name: params.name, definitionId });
  if (refusal !== undefined) {
    return { ok: false, refusal };
  }
  const name = params.name.trim();
  if (name === current.name) {
    return { ok: true, catalog };
  }
  return changed({ catalog, definition: { ...current, name }, at });
}

export interface DescribeDefinitionParams extends DefinitionChangeParams {
  /** Descrição nova; vazia, o processo fica sem descrição. */
  readonly description: string;
}

export function describeDefinition(
  params: DescribeDefinitionParams,
): CatalogResult {
  const { catalog, definitionId, at } = params;
  const current = findDefinition({ catalog, definitionId });
  if (current === undefined) {
    return NOT_FOUND;
  }
  const description = tidyDescription(params.description);
  if (description === current.description) {
    return { ok: true, catalog };
  }
  return changed({ catalog, definition: { ...current, description }, at });
}

/**
 * Acrescenta uma cópia do processo, com outro nome e sem as versões publicadas. O rascunho da cópia é o rascunho do
 * original ou, sem ele, o documento da última versão.
 */
export function duplicateDefinition(
  params: DefinitionChangeParams,
): CreationResult {
  const { catalog, definitionId, at } = params;
  const source = findDefinition({ catalog, definitionId });
  if (source === undefined) {
    return NOT_FOUND;
  }
  const published = latestVersion(source)?.documentText;
  const copy: ProcessDefinition = {
    id: nextDefinitionId(catalog),
    name: copyName({ catalog, name: source.name }),
    description: source.description,
    createdAt: at,
    updatedAt: at,
    draftText: source.draftText ?? published ?? null,
    versions: [],
  };
  return {
    ok: true,
    catalog: { definitions: [...catalog.definitions, copy] },
    definitionId: copy.id,
  };
}

export function archiveDefinition(
  params: DefinitionChangeParams,
): CatalogResult {
  const { catalog, definitionId, at } = params;
  const current = findDefinition({ catalog, definitionId });
  if (current === undefined) {
    return NOT_FOUND;
  }
  if (current.archived) {
    return { ok: true, catalog };
  }
  return changed({ catalog, definition: { ...current, archived: true }, at });
}

export function restoreDefinition(
  params: DefinitionChangeParams,
): CatalogResult {
  const { catalog, definitionId, at } = params;
  const current = findDefinition({ catalog, definitionId });
  if (current === undefined) {
    return NOT_FOUND;
  }
  if (!current.archived) {
    return { ok: true, catalog };
  }
  const definition: ProcessDefinition = { ...current, archived: undefined };
  return changed({ catalog, definition, at });
}

export interface SaveDraftParams extends DefinitionChangeParams {
  /** Texto do documento em edição. */
  readonly text: string;
}

export function saveDraft(params: SaveDraftParams): CatalogResult {
  const { catalog, definitionId, text, at } = params;
  const current = findDefinition({ catalog, definitionId });
  if (current === undefined) {
    return NOT_FOUND;
  }
  if (text === current.draftText) {
    return { ok: true, catalog };
  }
  return changed({ catalog, definition: { ...current, draftText: text }, at });
}

export interface PublishVersionParams extends DefinitionChangeParams {
  /** Texto do documento que está sendo publicado. */
  readonly documentText: string;
  /** Roteiro compilado desse documento. */
  readonly plan: ProcessPlan;
}

/**
 * Publica o documento como a versão seguinte do processo (a última mais 1). O rascunho passa a ser o documento
 * publicado, e as versões anteriores ficam como estavam. Publicar de novo o mesmo documento é recusado, então repetir
 * o pedido não cria versão duplicada.
 */
export function publishVersion(
  params: PublishVersionParams,
): PublicationResult {
  const { catalog, definitionId, documentText, at } = params;
  const current = findDefinition({ catalog, definitionId });
  if (current === undefined) {
    return NOT_FOUND;
  }
  const latest = latestVersion(current);
  if (latest !== undefined && latest.documentText === documentText) {
    const message = `Não há alterações desde a versão ${latest.version}.`;
    return { ok: false, refusal: { code: 'nothing-to-publish', message } };
  }
  // WHY: o roteiro passa pela mesma leitura que o catálogo gravado; uma versão que ela recusa sumiria do catálogo ao
  // recarregar a página.
  const plan = parsePlan(params.plan);
  if (plan === null) {
    const message = 'O desenho não forma um roteiro que possa ser executado.';
    return { ok: false, refusal: { code: 'invalid-plan', message } };
  }
  const version: ProcessVersion = {
    version: (latest?.version ?? 0) + 1,
    publishedAt: at,
    documentText,
    plan,
  };
  const definition: ProcessDefinition = {
    ...current,
    draftText: documentText,
    versions: [...current.versions, version],
  };
  const result = changed({ catalog, definition, at });
  return { ...result, version };
}

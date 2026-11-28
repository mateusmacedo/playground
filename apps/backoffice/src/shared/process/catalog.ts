import type { ProcessPlan } from './plan';

/** Versão publicada de um processo. Depois de publicada, não muda. */
export interface ProcessVersion {
  /** Número da versão, a partir de 1. */
  readonly version: number;
  /** Quando foi publicada (ISO 8601). */
  readonly publishedAt: string;
  /** Texto do documento do editor como foi publicado. Esta camada só o guarda; quem o lê é o editor. */
  readonly documentText: string;
  /** Roteiro compilado do documento, que as execuções seguem. */
  readonly plan: ProcessPlan;
}

/** Um processo do catálogo: o rascunho em edição e as versões já publicadas. */
export interface ProcessDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** Quando o processo foi criado (ISO 8601). */
  readonly createdAt: string;
  /** Quando o processo mudou pela última vez (ISO 8601). */
  readonly updatedAt: string;
  /** Texto do documento em edição, `null` enquanto nada foi salvo. Esta camada só o guarda. */
  readonly draftText: string | null;
  /** Versões publicadas, na ordem em que foram publicadas. */
  readonly versions: readonly ProcessVersion[];
  /** Processo arquivado fica fora do seletor do quadro e pode ser restaurado. */
  readonly archived?: boolean;
}

export interface ProcessCatalog {
  readonly definitions: readonly ProcessDefinition[];
}

export const EMPTY_CATALOG: ProcessCatalog = { definitions: [] };

export type CatalogRefusalCode =
  | 'not-found'
  | 'name-required'
  | 'name-taken'
  | 'invalid-plan'
  | 'nothing-to-publish';

/** Por que uma mudança do catálogo não foi feita. */
export interface CatalogRefusal {
  readonly code: CatalogRefusalCode;
  /** Motivo em PT-BR, pronto para a tela. */
  readonly message: string;
}

export interface CatalogRefused {
  readonly ok: false;
  readonly refusal: CatalogRefusal;
}

export interface CatalogChanged {
  readonly ok: true;
  /** Catálogo depois da mudança; é o mesmo objeto de antes quando não havia o que mudar. */
  readonly catalog: ProcessCatalog;
}

export interface DefinitionCreated extends CatalogChanged {
  /** Id do processo que acabou de entrar no catálogo. */
  readonly definitionId: string;
}

export interface VersionPublished extends CatalogChanged {
  /** Versão que acabou de ser publicada. */
  readonly version: ProcessVersion;
}

/** Resultado de uma mudança do catálogo (`catalog-changes`): o catálogo novo ou a recusa, nunca exceção. */
export type CatalogResult = CatalogChanged | CatalogRefused;
export type CreationResult = DefinitionCreated | CatalogRefused;
export type PublicationResult = VersionPublished | CatalogRefused;

export interface DefinitionLookup {
  readonly catalog: ProcessCatalog;
  readonly definitionId: string;
}

export function findDefinition(
  params: DefinitionLookup,
): ProcessDefinition | undefined {
  const { catalog, definitionId } = params;
  return catalog.definitions.find(
    (definition) => definition.id === definitionId,
  );
}

/** Versão publicada de maior número; `undefined` enquanto o processo não foi publicado. */
export function latestVersion(
  definition: ProcessDefinition,
): ProcessVersion | undefined {
  let latest: ProcessVersion | undefined;
  for (const version of definition.versions) {
    if (latest === undefined || version.version > latest.version) {
      latest = version;
    }
  }
  return latest;
}

export interface VersionLookup extends DefinitionLookup {
  /** Número da versão procurada. */
  readonly version: number;
}

/** Versão de número `version` do processo; `undefined` quando o processo ou a versão não está no catálogo. */
export function findVersion(params: VersionLookup): ProcessVersion | undefined {
  const definition = findDefinition(params);
  return definition?.versions.find(
    (version) => version.version === params.version,
  );
}

/** Processos que uma tarefa pode seguir: os não arquivados que têm versão publicada. */
export function publishedDefinitions(
  catalog: ProcessCatalog,
): readonly ProcessDefinition[] {
  return catalog.definitions.filter(
    (definition) => !definition.archived && definition.versions.length > 0,
  );
}

/**
 * O rascunho tem conteúdo que a última versão publicada não tem: o processo nunca foi publicado ou o rascunho mudou
 * depois dela. Sem rascunho salvo, não há o que publicar.
 */
export function hasUnpublishedChanges(definition: ProcessDefinition): boolean {
  const { draftText } = definition;
  if (draftText === null) {
    return false;
  }
  return draftText !== latestVersion(definition)?.documentText;
}

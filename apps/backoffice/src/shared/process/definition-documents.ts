import type { ProcessDefinition } from './catalog';
import { parseCatalog, serializeCatalog } from './catalog-format';
import { isRecord } from './stored-values';

/** Um processo como a API o guarda, fora a revisão: o envelope e o conteúdo no formato do catálogo gravado. */
export interface DefinitionContent {
  readonly id: string;
  /** Versão do formato de `definition`: a mesma do catálogo gravado no navegador. */
  readonly schemaVersion: number;
  /** O processo em JSON puro, como `serializeCatalog` grava cada um. */
  readonly definition: unknown;
}

/**
 * O processo no formato da API. Passa pelo mesmo texto que o navegador grava, para os dois lugares guardarem o mesmo
 * formato: o que o JSON não leva (campo `undefined`) fica de fora.
 */
export function definitionContent(
  definition: ProcessDefinition,
): DefinitionContent {
  const stored: unknown = JSON.parse(
    serializeCatalog({ definitions: [definition] }),
  );
  const { version, definitions } = stored as {
    readonly version: number;
    readonly definitions: readonly unknown[];
  };
  return {
    id: definition.id,
    schemaVersion: version,
    definition: definitions[0],
  };
}

/** Texto que identifica o conteúdo do processo: dois processos de mesmo texto são gravados iguais. */
export function contentText(content: DefinitionContent): string {
  return JSON.stringify(content.definition);
}

/**
 * Lê o processo de um documento da API com o leitor do catálogo gravado; `null` quando o formato é de outra versão, o
 * conteúdo não forma um processo ou o id de dentro não é o do documento.
 */
export function readDefinition(
  content: DefinitionContent,
): ProcessDefinition | null {
  const { id, schemaVersion, definition } = content;
  if (!isRecord(definition) || definition.id !== id) {
    return null;
  }
  const catalog = parseCatalog(
    JSON.stringify({ version: schemaVersion, definitions: [definition] }),
  );
  return catalog?.definitions[0] ?? null;
}

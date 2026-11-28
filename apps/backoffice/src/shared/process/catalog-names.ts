import type { CatalogRefusal, ProcessCatalog } from './catalog';

/** Nome para comparação: sem espaços nas pontas e sem diferenciar maiúsculas. */
function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase('pt-BR');
}

export interface NameCheckParams {
  readonly catalog: ProcessCatalog;
  readonly name: string;
  /** Processo que está sendo renomeado: o nome atual dele não conta como repetido. */
  readonly definitionId?: string;
}

/**
 * Por que o nome não serve para um processo; `undefined` quando serve. O nome é obrigatório e único no catálogo, sem
 * diferenciar maiúsculas e contando os arquivados, que podem voltar.
 */
export function nameRefusal(
  params: NameCheckParams,
): CatalogRefusal | undefined {
  const { catalog, definitionId } = params;
  const key = nameKey(params.name);
  if (key === '') {
    return { code: 'name-required', message: 'Informe o nome do processo.' };
  }
  const other = catalog.definitions.find(
    (definition) =>
      definition.id !== definitionId && nameKey(definition.name) === key,
  );
  if (other === undefined) {
    return undefined;
  }
  const message = other.archived
    ? 'Já existe um processo arquivado com este nome.'
    : 'Já existe um processo com este nome.';
  return { code: 'name-taken', message };
}

export interface CopyNameParams {
  readonly catalog: ProcessCatalog;
  /** Nome do processo copiado. */
  readonly name: string;
}

/** Nome da cópia: `<nome> (cópia)` ou, com esse em uso, `<nome> (cópia 2)`, `(cópia 3)` e assim por diante. */
export function copyName(params: CopyNameParams): string {
  const { catalog, name } = params;
  let candidate = `${name} (cópia)`;
  let count = 2;
  while (nameRefusal({ catalog, name: candidate }) !== undefined) {
    candidate = `${name} (cópia ${count})`;
    count += 1;
  }
  return candidate;
}

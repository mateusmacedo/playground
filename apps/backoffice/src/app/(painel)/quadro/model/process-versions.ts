import {
  findDefinition,
  latestVersion,
  type ProcessCatalog,
} from '@/shared/process/catalog';
import type { ProcessRun } from '@/shared/process/run';

import type { BoardProcess } from './board';

/**
 * Processos que um card pode começar a seguir: os publicados e não arquivados do catálogo, cada um na última versão,
 * já com o roteiro que o quadro guarda.
 */
export function startableProcesses(
  catalog: ProcessCatalog,
): readonly BoardProcess[] {
  const processes: BoardProcess[] = [];
  for (const definition of catalog.definitions) {
    const latest = latestVersion(definition);
    // NOTE: sem versão publicada não há roteiro a seguir, e o processo arquivado saiu de uso.
    if (definition.archived || latest === undefined) {
      continue;
    }
    processes.push({
      definitionId: definition.id,
      version: latest.version,
      name: definition.name,
      plan: latest.plan,
    });
  }
  return processes;
}

export interface NewerVersionParams {
  readonly catalog: ProcessCatalog;
  /** Execução que segue a versão em que começou. */
  readonly run: Pick<ProcessRun, 'definitionId' | 'version'>;
}

/**
 * Número da versão mais nova que a da execução, quando o catálogo já tem uma publicada; `undefined` quando a execução
 * está na última, ou quando o processo saiu do catálogo ou foi arquivado.
 */
export function newerVersion(params: NewerVersionParams): number | undefined {
  const { catalog, run } = params;
  const definition = findDefinition({
    catalog,
    definitionId: run.definitionId,
  });
  if (!definition || definition.archived) {
    return undefined;
  }
  const latest = latestVersion(definition);
  return latest && latest.version > run.version ? latest.version : undefined;
}

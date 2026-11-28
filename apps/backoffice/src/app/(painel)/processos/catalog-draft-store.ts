import {
  findDefinition,
  latestVersion,
  type ProcessCatalog,
} from '@/shared/process/catalog';
import { saveDraft } from '@/shared/process/catalog-changes';
import type { CatalogSession } from '@/shared/process/catalog-session-contract';

import type { DraftStore } from './draft-store';

export interface DraftOpeningParams {
  readonly catalog: ProcessCatalog;
  readonly definitionId: string;
}

/**
 * Texto com que o editor abre o processo: o rascunho ou, sem rascunho gravado, o desenho da última versão publicada.
 * `null` quando não há nenhum dos dois ou o processo não está no catálogo.
 */
export function draftOpeningText(params: DraftOpeningParams): string | null {
  const definition = findDefinition(params);
  if (definition === undefined) {
    return null;
  }
  const published = latestVersion(definition)?.documentText;
  return definition.draftText ?? published ?? null;
}

export interface CatalogDraftStoreParams {
  /** Processo do catálogo cujo rascunho o editor lê e grava. */
  readonly definitionId: string;
  /** Catálogo que a tela mostra; é dele que o editor abre o processo. */
  readonly current: () => ProcessCatalog;
  /** Aplica a mudança no catálogo da tela e espera a gravação dela. */
  readonly commit: CatalogSession['commit'];
  /** Instante da gravação (ISO 8601). */
  readonly now: () => string;
}

/**
 * Rascunho de um processo do catálogo, na porta que o editor já usa. A abertura lê o catálogo da tela; a gravação é
 * uma mudança desse catálogo, que só troca o rascunho do processo e espera o armazenamento confirmar. Rejeita quando o
 * processo saiu do catálogo ou a gravação não foi feita, como o adaptador antigo.
 */
export function createCatalogDraftStore(
  params: CatalogDraftStoreParams,
): DraftStore {
  const { definitionId, current, commit, now } = params;
  return {
    load() {
      return draftOpeningText({ catalog: current(), definitionId });
    },
    async save(text) {
      const outcome = await commit((catalog) =>
        saveDraft({ catalog, definitionId, text, at: now() }),
      );
      switch (outcome.kind) {
        case 'saved':
          return;
        case 'refused':
          throw new Error(outcome.refusal.message);
        case 'failed':
          throw new Error(outcome.failure.message);
        case 'discarded':
          throw new Error(
            'O rascunho foi descartado ao recarregar o processo.',
          );
      }
    },
  };
}

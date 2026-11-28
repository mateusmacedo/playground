import type { ProcessVersion } from '@/shared/process/catalog';
import { publishVersion } from '@/shared/process/catalog-changes';
import type { CatalogSession } from '@/shared/process/catalog-session-contract';
import type { ProcessPlan } from '@/shared/process/plan';

import { laneIssues, type ProcessDocument } from './model/document';
import { countIssues } from './model/issues';
import { findIssues } from './model/validation';

/** O que o editor entrega para publicar: o documento como está na tela e o roteiro compilado dele. */
export interface PublishRequest {
  readonly documentText: string;
  readonly plan: ProcessPlan;
}

export interface Published {
  readonly kind: 'published';
  /** Número da versão que acabou de ser publicada. */
  readonly version: number;
}

export interface PublishRefused {
  readonly kind: 'refused';
  /** Motivo em PT-BR, pronto para a tela. */
  readonly message: string;
}

/** A versão não foi gravada: o navegador recusou (cota cheia, armazenamento bloqueado) ou o servidor não respondeu. */
export interface PublishFailed {
  readonly kind: 'failed';
}

export type PublishOutcome = Published | PublishRefused | PublishFailed;

export interface PublishDraftParams extends PublishRequest {
  /** Aplica a mudança no catálogo da tela e espera a gravação dela. */
  readonly commit: CatalogSession['commit'];
  readonly definitionId: string;
  /** Instante da publicação (ISO 8601). */
  readonly at: string;
}

/**
 * Publica o documento como a versão seguinte do processo. O rascunho e a versão entram na mesma mudança do catálogo
 * da tela, e a versão só conta como publicada depois que o armazenamento confirma. O desenho não é validado aqui:
 * quem chama confere antes.
 */
export async function publishDraft(
  params: PublishDraftParams,
): Promise<PublishOutcome> {
  const { commit, definitionId, documentText, plan, at } = params;
  const outcome = await commit((catalog) =>
    publishVersion({ catalog, definitionId, documentText, plan, at }),
  );
  if (outcome.kind === 'saved') {
    return { kind: 'published', version: outcome.result.version.version };
  }
  if (outcome.kind === 'refused') {
    return { kind: 'refused', message: outcome.refusal.message };
  }
  // NOTE: a gravação falhou ou a mudança foi descartada ao recarregar o processo; para o editor, a versão não saiu.
  return { kind: 'failed' };
}

/** O que a tela do catálogo entrega ao editor para publicar o processo aberto e mostrar as versões dele. */
export interface EditorPublication {
  /** Última versão publicada do processo aberto; `undefined` enquanto não há nenhuma. */
  readonly latest: ProcessVersion | undefined;
  readonly versionCount: number;
  readonly publish: (request: PublishRequest) => Promise<PublishOutcome>;
  readonly onShowVersions: () => void;
}

/** Erros do processo inteiro (raias, nível principal e subprocessos), que impedem a publicação. */
export function documentErrorCount(document: ProcessDocument): number {
  const issues = [...laneIssues(document.lanes), ...findIssues(document.graph)];
  return countIssues(issues).errors;
}

export interface PublishBlockerParams {
  /** Erros do processo inteiro. */
  readonly errors: number;
  /** Texto do documento como está na tela. */
  readonly text: string;
  readonly latest: ProcessVersion | undefined;
}

/** Por que o processo não pode ser publicado agora, em PT-BR; `null` quando pode. */
export function publishBlocker(params: PublishBlockerParams): string | null {
  const { errors, text, latest } = params;
  if (errors === 1) {
    return 'Corrija o erro do processo para publicar.';
  }
  if (errors > 1) {
    return `Corrija os ${errors} erros do processo para publicar.`;
  }
  if (latest !== undefined && latest.documentText === text) {
    return `Não há alterações desde a versão ${latest.version}.`;
  }
  return null;
}

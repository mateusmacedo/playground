import type { RunViewRefParams } from '@/shared/process/run-view-store';

import { REF_PARAM } from './use-run-view';

/** Endereço da página das execuções: sem a referência de uma execução, ela mostra a lista das que estão em andamento. */
export const RUNS_HREF = '/processos/execucao';

export function runDiagramHref(ref: RunViewRefParams): string {
  // WHY: cada id é codificado à parte e o `:` fica como está, porque a página corta a referência no primeiro `:`.
  const boardId = encodeURIComponent(ref.boardId);
  const cardId = encodeURIComponent(ref.cardId);
  return `${RUNS_HREF}?${REF_PARAM}=${boardId}:${cardId}`;
}

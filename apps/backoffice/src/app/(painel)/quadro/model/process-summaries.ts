import { allCards, type Board } from './board';
import { type ProcessSummary, processSummary } from './process-summary';

export interface ProcessSummariesParams {
  readonly board: Board;
  /** Instante da consulta (ISO 8601), para dizer o que está atrasado; sem ele, nada conta como atrasado. */
  readonly now?: string;
}

/** Resumo do processo de cada card das colunas que tem um, pelo id do card; card sem roteiro no quadro fica de fora. */
export function processSummaries(
  params: ProcessSummariesParams,
): ReadonlyMap<string, ProcessSummary> {
  const { board, now } = params;
  const summaries = new Map<string, ProcessSummary>();
  for (const card of allCards(board.lanes)) {
    const summary = processSummary({ board, card, now });
    if (summary) {
      summaries.set(card.id, summary);
    }
  }
  return summaries;
}

/** Diz se algum card das colunas tem processo em andamento: só então o quadro precisa acompanhar o relógio. */
export function hasRunningProcess(board: Board): boolean {
  return allCards(board.lanes).some(
    (card) => card.process?.status === 'running',
  );
}

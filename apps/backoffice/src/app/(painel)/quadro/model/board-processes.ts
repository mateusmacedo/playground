import type { ProcessPlan } from '@/shared/process/plan';
import type { ProcessRun } from '@/shared/process/run';

import { allCards, type Board, type BoardProcess } from './board';
import { archivedCards } from './board-state';

/** O que identifica o roteiro de uma execução: a definição e a versão em que ela começou. */
export type ProcessRef = Pick<ProcessRun, 'definitionId' | 'version'>;

/** Chave do roteiro no quadro. */
export function processKey(ref: ProcessRef): string {
  return `${ref.definitionId}:${ref.version}`;
}

export interface PlanForParams {
  readonly board: Board;
  readonly run: ProcessRef;
}

/** Roteiro da versão em que a execução começou; `undefined` quando o quadro não o tem. */
export function planFor(params: PlanForParams): ProcessPlan | undefined {
  const key = processKey(params.run);
  const processes = params.board.processes ?? [];
  return processes.find((process) => processKey(process) === key)?.plan;
}

export interface KeepProcessParams {
  readonly board: Board;
  readonly process: BoardProcess;
}

/** Guarda o roteiro no quadro; a versão que o quadro já tem fica como está, porque versão publicada não muda. */
export function keepProcess(params: KeepProcessParams): Board {
  const { board, process } = params;
  if (planFor({ board, run: process }) !== undefined) {
    return board;
  }
  return { ...board, processes: [...(board.processes ?? []), process] };
}

/** Diz se as duas execuções são a mesma, em momentos diferentes. */
export function sameRun(
  a: ProcessRun | undefined,
  b: ProcessRun | undefined,
): boolean {
  return (
    a !== undefined &&
    b !== undefined &&
    processKey(a) === processKey(b) &&
    a.startedAt === b.startedAt
  );
}

/** Chaves dos roteiros que algum card usa, contando os arquivados. */
function usedKeys(board: Board): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const card of [...allCards(board.lanes), ...archivedCards(board)]) {
    if (card.process) {
      keys.add(processKey(card.process));
    }
  }
  return keys;
}

/** Tira do quadro os roteiros que nenhum card usa; sem nenhum sobrando, devolve o próprio `board`. */
export function pruneProcesses(board: Board): Board {
  const processes = board.processes ?? [];
  if (processes.length === 0) {
    return board;
  }
  const used = usedKeys(board);
  const kept = processes.filter((process) => used.has(processKey(process)));
  if (kept.length === processes.length) {
    return board;
  }
  return { ...board, processes: kept.length > 0 ? kept : undefined };
}

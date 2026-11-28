import { advance, type RunAction, startRun } from '@/shared/process/engine';
import type { RunResult } from '@/shared/process/engine-result';
import type { ProcessPlan } from '@/shared/process/plan';
import type { ProcessRun } from '@/shared/process/run';

import {
  type Board,
  type BoardCard,
  type BoardLane,
  type BoardProcess,
  findCard,
  updateCardIn,
} from './board';
import { keepProcess, planFor } from './board-processes';

/** O quadro com a mudança do processo aplicada. */
export interface AcceptedProcessChange {
  readonly ok: true;
  readonly board: Board;
}

/** O quadro recusou a mudança do processo; a mensagem, em uma frase, é para quem pediu. */
export interface RefusedProcessChange {
  readonly ok: false;
  readonly message: string;
}

export type ProcessChange = AcceptedProcessChange | RefusedProcessChange;

export const CARD_MISSING = 'O card não está mais no quadro.';
export const ALREADY_RUNNING =
  'O card já tem um processo em andamento: conclua ou cancele o processo antes de iniciar outro.';
export const NO_PROCESS = 'O card não tem processo.';
export const PLAN_MISSING =
  'O roteiro deste processo não está mais no quadro: remova o processo do card e inicie de novo.';

export function refusedChange(message: string): RefusedProcessChange {
  return { ok: false, message };
}

interface CardRunParams {
  readonly board: Board;
  readonly cardId: string;
  /** Resultado do motor para a execução do card. */
  readonly result: RunResult;
}

/** Grava no card a execução que o motor devolveu, ou repassa a recusa dele. */
function withRunResult(params: CardRunParams): ProcessChange {
  const { board, cardId, result } = params;
  if (!result.ok) {
    return refusedChange(result.refusal.message);
  }
  const process = result.run;
  const lanes = updateCardIn({
    lanes: board.lanes,
    cardId,
    // NOTE: a ação que não muda a execução (desfazer uma delegação que não existe) não vira passo do desfazer.
    update: (card) => (card.process === process ? card : { ...card, process }),
  });
  const changed = lanes === board.lanes ? board : { ...board, lanes };
  return { ok: true, board: changed };
}

export interface StartProcessParams {
  readonly board: Board;
  readonly cardId: string;
  /** Versão publicada que o card vai seguir; o roteiro dela fica guardado no quadro. */
  readonly process: BoardProcess;
  /** Instante do início, ISO 8601. */
  readonly at: string;
  readonly by?: string;
}

/**
 * Inicia no card a execução de uma versão de processo e guarda o roteiro dela no quadro. Recusa o card que já tem
 * execução em andamento; a encerrada dá lugar à nova.
 */
export function startProcess(params: StartProcessParams): ProcessChange {
  const { board, cardId, process, at, by } = params;
  const card = findCard({ lanes: board.lanes, cardId })?.card;
  if (!card) {
    return refusedChange(CARD_MISSING);
  }
  if (card.process?.status === 'running') {
    return refusedChange(ALREADY_RUNNING);
  }
  const { definitionId, version, name, plan } = process;
  const result = startRun({ definitionId, version, name, plan, at, by });
  return withRunResult({
    board: keepProcess({ board, process }),
    cardId,
    result,
  });
}

/** O card com a execução dele e o roteiro dela. */
export interface FoundCardRun {
  readonly ok: true;
  readonly card: BoardCard;
  /** Coluna em que o card está. */
  readonly lane: BoardLane;
  readonly run: ProcessRun;
  readonly plan: ProcessPlan;
}

export type CardRun = FoundCardRun | RefusedProcessChange;

export interface CardRunOfParams {
  readonly board: Board;
  readonly cardId: string;
}

/** A execução do card com o roteiro dela, ou a recusa que explica por que não dá para agir nela. */
export function cardRunOf(params: CardRunOfParams): CardRun {
  const { board, cardId } = params;
  const location = findCard({ lanes: board.lanes, cardId });
  if (!location) {
    return refusedChange(CARD_MISSING);
  }
  const { card, lane } = location;
  const run = card.process;
  if (!run) {
    return refusedChange(NO_PROCESS);
  }
  const plan = planFor({ board, run });
  if (!plan) {
    return refusedChange(PLAN_MISSING);
  }
  return { ok: true, card, lane, run, plan };
}

export interface AdvanceProcessParams {
  readonly board: Board;
  readonly cardId: string;
  readonly action: RunAction;
  /** Instante da ação, ISO 8601. */
  readonly at: string;
  readonly by?: string;
}

/** Aplica a ação à execução do card; o que o motor não aceita volta como recusa, com a mensagem dele. */
export function advanceProcess(params: AdvanceProcessParams): ProcessChange {
  const { board, cardId, action, at, by } = params;
  const found = cardRunOf({ board, cardId });
  if (!found.ok) {
    return found;
  }
  const { run, plan } = found;
  const result = advance({ plan, run, action, at, by });
  return withRunResult({ board, cardId, result });
}

export interface RemoveProcessParams {
  readonly board: Board;
  readonly cardId: string;
}

interface CardRunCheck {
  readonly board: Board;
  readonly run: ProcessRun;
}

/** Diz se dá para tirar a execução do card: ela já acabou, ou ficou sem roteiro e não tem como andar. */
function isRemovable(params: CardRunCheck): boolean {
  const { board, run } = params;
  return run.status !== 'running' || planFor({ board, run }) === undefined;
}

/**
 * Tira do card a execução concluída, cancelada ou sem roteiro; o histórico do card fica. A que está em andamento
 * continua, e o `board` volta como veio: para tirá-la, cancele antes.
 */
export function removeProcess(params: RemoveProcessParams): Board {
  const { board, cardId } = params;
  const lanes = updateCardIn({
    lanes: board.lanes,
    cardId,
    update: (card) => {
      const run = card.process;
      if (!run || !isRemovable({ board, run })) {
        return card;
      }
      return { ...card, process: undefined };
    },
  });
  return lanes === board.lanes ? board : { ...board, lanes };
}

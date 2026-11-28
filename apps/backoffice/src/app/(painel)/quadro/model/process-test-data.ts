import { begin, tokenAt } from '@/shared/process/engine-test-kit';
import { linearPlan } from '@/shared/process/engine-test-plans';
import type { ProcessPlan } from '@/shared/process/plan';
import type { ProcessRun } from '@/shared/process/run';

import type { Board, BoardCard, BoardProcess, BoardRules } from './board';
import { createBoard } from './board-state';

/** Instante das mudanças nos testes do processo do card. */
export const CHANGED_AT = '2026-11-26T12:00:00.000Z';

/** Coluna de conclusão dos quadros de teste. */
export const DONE_LANE = 'done';

/** Roteiro de teste com a mesma definição e versão que o `begin` do motor usa. */
export function boardProcess(plan: ProcessPlan = linearPlan): BoardProcess {
  return { definitionId: 'process-1', version: 1, name: 'Processo', plan };
}

export interface ProcessBoardParams {
  /** Cards da coluna `todo` (A fazer). */
  readonly todo?: readonly BoardCard[];
  /** Cards da coluna `doing` (Em andamento). */
  readonly doing?: readonly BoardCard[];
  /** Cards da coluna de conclusão `done` (Concluído). */
  readonly done?: readonly BoardCard[];
  readonly rules?: BoardRules;
  readonly processes?: readonly BoardProcess[];
  /** Tira a coluna de conclusão da configuração. */
  readonly withoutDoneLane?: boolean;
}

/** Quadro de três colunas, com a última como coluna de conclusão. */
export function processBoard(params: ProcessBoardParams = {}): Board {
  return createBoard({
    lanes: [
      { id: 'todo', title: 'A fazer', cards: params.todo ?? [] },
      { id: 'doing', title: 'Em andamento', cards: params.doing ?? [] },
      { id: DONE_LANE, title: 'Concluído', cards: params.done ?? [] },
    ],
    config: {
      keyPrefix: 'QD',
      doneLaneId: params.withoutDoneLane ? undefined : DONE_LANE,
      rules: params.rules,
    },
    processes: params.processes,
  });
}

export interface RunningCardParams {
  readonly id: string;
  readonly plan?: ProcessPlan;
  readonly parentId?: string;
}

/** Card com a execução do roteiro recém-iniciada. */
export function runningCard(params: RunningCardParams): BoardCard {
  const { id, parentId, plan = linearPlan } = params;
  return { id, title: `Card ${id}`, parentId, process: begin(plan) };
}

export interface DelegatedPairParams {
  readonly ownerId: string;
  readonly childId: string;
  /** Etapa em que a ficha entregue ao filho está parada. */
  readonly stepRef: string;
  readonly plan?: ProcessPlan;
}

export interface DelegatedPair {
  readonly owner: BoardCard;
  readonly child: BoardCard;
  readonly tokenId: string;
}

/** Card dono com a ficha da etapa entregue ao card filho, e o filho ligado a ela. */
export function delegatedPair(params: DelegatedPairParams): DelegatedPair {
  const { ownerId, childId, stepRef, plan = linearPlan } = params;
  const run = begin(plan);
  const tokenId = tokenAt({ run, stepRef }).id;
  const tokens = run.tokens.map((token) =>
    token.id === tokenId ? { ...token, delegateId: childId } : token,
  );
  const process: ProcessRun = { ...run, tokens };
  return {
    owner: { id: ownerId, title: `Card ${ownerId}`, process },
    child: {
      id: childId,
      title: `Card ${childId}`,
      parentId: ownerId,
      stepOf: { cardId: ownerId, tokenId },
    },
    tokenId,
  };
}

export interface CardOfParams {
  readonly board: Board;
  readonly cardId: string;
}

/** O card do quadro; falha o teste quando ele não está nas colunas. */
export function cardOf(params: CardOfParams): BoardCard {
  const { board, cardId } = params;
  for (const lane of board.lanes) {
    const card = lane.cards.find((candidate) => candidate.id === cardId);
    if (card) {
      return card;
    }
  }
  throw new Error(`Card ${cardId} fora das colunas.`);
}

/** A execução do card; falha o teste quando ele não tem nenhuma. */
export function runOf(card: BoardCard): ProcessRun {
  if (!card.process) {
    throw new Error(`Card ${card.id} sem processo.`);
  }
  return card.process;
}

export interface LaneCardIdsParams {
  readonly board: Board;
  readonly laneId: string;
}

/** Ids dos cards da coluna. */
export function laneCardIds(params: LaneCardIdsParams): readonly string[] {
  const lane = params.board.lanes.find((item) => item.id === params.laneId);
  return lane?.cards.map((card) => card.id) ?? [];
}

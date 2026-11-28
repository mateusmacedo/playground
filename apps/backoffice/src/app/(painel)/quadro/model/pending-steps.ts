import { type ActiveStep, activeSteps } from '@/shared/process/engine-active';
import { isOverdue } from '@/shared/process/engine-due';
import type { StepKind } from '@/shared/process/plan';

import { type Board, type BoardCard, type BoardLane, findCard } from './board';
import { planFor } from './board-processes';
import { personName } from './people';

/** Etapa de processo do quadro à espera de uma ação, como a visão "Etapas" mostra. */
export interface PendingStep {
  /** Card dono do processo. */
  readonly card: BoardCard;
  /** Coluna do card dono. */
  readonly lane: BoardLane;
  /** A ficha, a etapa e o que dá para fazer nela, como o motor informa. */
  readonly active: ActiveStep;
  readonly label: string;
  readonly kind: StepKind;
  readonly role?: string;
  /** Card filho que executa a etapa, quando ela foi entregue a um. */
  readonly delegate?: BoardCard;
  /** Nome do responsável: o do card filho que executa a etapa ou, sem ele, o do card dono. */
  readonly assignee?: string;
  /** Desde quando a etapa espera, ISO 8601. */
  readonly since: string;
  /** Prazo da etapa, ISO 8601. */
  readonly dueAt?: string;
  /** O prazo já passou; sem o instante da consulta, nunca. */
  readonly overdue: boolean;
}

export interface PendingStepsParams {
  readonly board: Board;
  /** Instante da consulta (ISO 8601), para dizer o que está atrasado. */
  readonly now?: string;
}

interface StepOfCardParams {
  readonly board: Board;
  readonly card: BoardCard;
  readonly lane: BoardLane;
  readonly active: ActiveStep;
  readonly now?: string;
}

function pendingStepOf(params: StepOfCardParams): PendingStep {
  const { board, card, lane, active, now } = params;
  const { step, token, dueAt } = active;
  const delegateId = token.delegateId;
  const delegate =
    delegateId === undefined
      ? undefined
      : findCard({ lanes: board.lanes, cardId: delegateId })?.card;
  const responsible = delegate ?? card;
  return {
    card,
    lane,
    active,
    label: step.label,
    kind: step.kind,
    role: step.role,
    delegate,
    assignee: personName({ board, personId: responsible.assigneeId }),
    since: token.since,
    dueAt,
    overdue: now !== undefined && isOverdue({ at: now, dueAt }),
  };
}

/** Mais cedo primeiro; sem prazo vai para o fim. */
function compareDue(a: PendingStep, b: PendingStep): number {
  if (a.dueAt === b.dueAt) {
    return 0;
  }
  if (a.dueAt === undefined) {
    return 1;
  }
  if (b.dueAt === undefined) {
    return -1;
  }
  return Date.parse(a.dueAt) - Date.parse(b.dueAt);
}

/**
 * Etapas dos processos dos cards das colunas que esperam uma ação, da que vence primeiro para a última; as sem prazo
 * vão para o fim, e o empate fica com a que espera há mais tempo e, depois, com a ordem do quadro. A ficha à espera
 * numa junção e o subprocesso aberto não entram: não há o que fazer neles.
 */
export function pendingSteps(
  params: PendingStepsParams,
): readonly PendingStep[] {
  const { board, now } = params;
  const steps: PendingStep[] = [];
  for (const lane of board.lanes) {
    for (const card of lane.cards) {
      const run = card.process;
      const plan = run && planFor({ board, run });
      if (!run || !plan) {
        continue;
      }
      for (const active of activeSteps({ plan, run })) {
        if (active.state === 'pending') {
          steps.push(pendingStepOf({ board, card, lane, active, now }));
        }
      }
    }
  }
  // NOTE: a ordenação é estável, então o empate completo fica na ordem do quadro.
  steps.sort((a, b) => {
    const byDue = compareDue(a, b);
    if (byDue !== 0) {
      return byDue;
    }
    return Date.parse(a.since) - Date.parse(b.since);
  });
  return steps;
}

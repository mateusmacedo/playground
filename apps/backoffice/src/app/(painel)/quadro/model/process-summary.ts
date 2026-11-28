import { type ActiveStep, activeSteps } from '@/shared/process/engine-active';
import { isOverdue } from '@/shared/process/engine-due';
import {
  type RunProgress,
  runProgress,
} from '@/shared/process/engine-progress';
import type { RunOutcome, RunStatus } from '@/shared/process/run';

import type { Board, BoardCard } from './board';
import { planFor } from './board-processes';

/** Etapa em que a execução do card está parada, com o que a tela precisa para dizer se ela está atrasada. */
export interface SummaryStep {
  /** A ficha, a etapa e o que dá para fazer nela, como o motor informa. */
  readonly active: ActiveStep;
  /** O prazo da etapa já passou; sem o instante da consulta, nunca. */
  readonly overdue: boolean;
}

/** Resumo do processo do card: o que o card, o painel e as visões mostram sem conhecer o motor. */
export interface ProcessSummary {
  readonly name: string;
  readonly version: number;
  readonly status: RunStatus;
  /** Etapas feitas, restantes e o total. */
  readonly progress: RunProgress;
  /** Etapas em que a execução está parada, na ordem das fichas; vazio na execução encerrada. */
  readonly steps: readonly SummaryStep[];
  /** Alguma etapa parada passou do prazo. */
  readonly overdue: boolean;
  /** Desfecho da execução concluída. */
  readonly outcome?: RunOutcome;
}

export interface ProcessSummaryParams {
  readonly board: Board;
  readonly card: BoardCard;
  /** Instante da consulta (ISO 8601), para dizer o que está atrasado; sem ele, nada conta como atrasado. */
  readonly now?: string;
}

/**
 * Resumo do processo do card: nome, situação, andamento, etapas em que está parado e se alguma passou do prazo.
 * `undefined` quando o card não tem processo ou o quadro não tem o roteiro dele.
 */
export function processSummary(
  params: ProcessSummaryParams,
): ProcessSummary | undefined {
  const { board, card, now } = params;
  const run = card.process;
  if (!run) {
    return undefined;
  }
  const plan = planFor({ board, run });
  if (!plan) {
    return undefined;
  }
  const steps: SummaryStep[] = [];
  for (const active of activeSteps({ plan, run })) {
    const overdue =
      now !== undefined && isOverdue({ at: now, dueAt: active.dueAt });
    steps.push({ active, overdue });
  }
  return {
    name: run.name,
    version: run.version,
    status: run.status,
    progress: runProgress({ plan, run }),
    steps,
    overdue: steps.some((step) => step.overdue),
    outcome: run.outcome,
  };
}

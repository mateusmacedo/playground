import { type RunningCard, readRunningCards } from './board-run';
import { type ActiveStep, activeSteps } from './engine-active';
import { isOverdue } from './engine-due';
import { type RunProgress, runProgress } from './engine-progress';
import { isWithin, type StepRef } from './plan';
import type { RunViewRefParams } from './run-view-store';

/** Etapa em que uma execução está parada, como a lista de execuções a mostra. */
export interface BoardRunStep {
  /** Id da ficha parada na etapa: distingue as etapas da mesma execução. */
  readonly tokenId: string;
  /** Nome da etapa, precedido dos subprocessos que a contêm. */
  readonly label: string;
  /** Parada numa junção, à espera dos outros caminhos. */
  readonly waiting: boolean;
  /** O prazo da etapa, ou o de um subprocesso que a contém, já passou. */
  readonly overdue: boolean;
}

/** Execução em andamento de um card, com o que a lista de execuções mostra. */
export interface BoardRun {
  /** O quadro e o card: a referência do diagrama da execução. */
  readonly ref: RunViewRefParams;
  readonly boardName: string;
  /** O código e o título do card. */
  readonly cardLabel: string;
  /** Endereço do card no quadro. */
  readonly cardHref: string;
  readonly processName: string;
  /** Versão do processo em que a execução começou. */
  readonly version: number;
  /** Etapas em que a execução está parada, na ordem das fichas. */
  readonly steps: readonly BoardRunStep[];
  /** Etapas feitas, restantes e o total. */
  readonly progress: RunProgress;
  /** Quando a execução começou (ISO 8601). */
  readonly startedAt: string;
  /** Alguma etapa em que a execução está parada passou do prazo. */
  readonly overdue: boolean;
}

const TRAIL_SEPARATOR = ' › ';
const UNNAMED_STEP = 'Etapa sem nome';
const UNNAMED_PROCESS = 'Processo sem nome';

interface NamedParams {
  readonly name: string;
  readonly fallback: string;
}

function named(params: NamedParams): string {
  const { name, fallback } = params;
  return name.trim() === '' ? fallback : name;
}

function stepLabel(active: ActiveStep): string {
  const names: string[] = [];
  for (const step of [...active.trail, active.step]) {
    names.push(named({ name: step.label, fallback: UNNAMED_STEP }));
  }
  return names.join(TRAIL_SEPARATOR);
}

interface CardAtParams {
  readonly card: RunningCard;
  /** Instante da consulta (ISO 8601), para dizer o que está atrasado. */
  readonly at: string;
}

/**
 * Etapas em que a execução do card está parada. O subprocesso aberto não vira linha própria: ele aparece no nome das
 * etapas de dentro, e o atraso dele vale para elas.
 */
function stepsOf(params: CardAtParams): readonly BoardRunStep[] {
  const { card, at } = params;
  const active = activeSteps({ plan: card.plan, run: card.run });
  const lateScopes: StepRef[] = [];
  for (const item of active) {
    if (item.state === 'scope' && isOverdue({ at, dueAt: item.dueAt })) {
      lateScopes.push(item.token.stepRef);
    }
  }
  const steps: BoardRunStep[] = [];
  for (const item of active) {
    if (item.state === 'scope') {
      continue;
    }
    const { stepRef } = item.token;
    const insideLateScope = lateScopes.some((scope) =>
      isWithin({ stepRef, scope }),
    );
    steps.push({
      tokenId: item.token.id,
      label: stepLabel(item),
      waiting: item.state === 'waiting',
      overdue: insideLateScope || isOverdue({ at, dueAt: item.dueAt }),
    });
  }
  return steps;
}

export interface BoardRunsParams {
  readonly boardId: string;
  readonly boardName: string;
  /** O conteúdo do quadro (`board`), como veio da API ou do navegador, ainda sem formato garantido. */
  readonly board: unknown;
  /** Instante da consulta (ISO 8601), para dizer o que está atrasado. */
  readonly at: string;
}

/**
 * Execuções em andamento dos cards das colunas de um quadro, na ordem da tela. O roteiro de cada uma é o que o quadro
 * guarda, e as etapas, o progresso e o atraso vêm do motor.
 */
export function boardRunsOf(params: BoardRunsParams): readonly BoardRun[] {
  const { boardId, boardName, board, at } = params;
  const runs: BoardRun[] = [];
  for (const card of readRunningCards({ boardId, board })) {
    const steps = stepsOf({ card, at });
    runs.push({
      ref: { boardId, cardId: card.cardId },
      boardName,
      cardLabel: card.cardLabel,
      cardHref: card.cardHref,
      processName: named({ name: card.run.name, fallback: UNNAMED_PROCESS }),
      version: card.run.version,
      steps,
      progress: runProgress({ plan: card.plan, run: card.run }),
      startedAt: card.run.startedAt,
      overdue: steps.some((step) => step.overdue),
    });
  }
  return runs;
}

/** As atrasadas primeiro; depois, as iniciadas há mais tempo. O empate fica na ordem em que as execuções vieram. */
export function sortRuns(runs: readonly BoardRun[]): readonly BoardRun[] {
  return [...runs].sort((a, b) => {
    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }
    return Date.parse(a.startedAt) - Date.parse(b.startedAt);
  });
}

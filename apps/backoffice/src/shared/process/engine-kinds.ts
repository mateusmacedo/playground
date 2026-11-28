import type {
  ExitMeaning,
  PlanEvent,
  PlanEventTrigger,
  PlanExit,
  PlanStep,
  ProcessPlan,
  StepKind,
} from './plan';
import type { RunToken } from './run';

/** Como uma etapa acionável é resolvida: `complete` conclui e `choose` escolhe por onde seguir. */
export type StepResolution = 'complete' | 'choose';

const COMPLETE_KINDS: readonly StepKind[] = [
  'task',
  'human-task',
  'automated-task',
  'send-message',
  'timer',
];

const CHOOSE_KINDS: readonly StepKind[] = [
  'decision',
  'inclusive-split',
  'wait-event',
  'approval',
];

/**
 * Processo interno em que a execução consegue entrar: o do subprocesso, quando a etapa de início dele existe. Sem
 * isso, o subprocesso vale como tarefa simples.
 */
export function innerPlanOf(step: PlanStep): ProcessPlan | undefined {
  const { inner } = step;
  if (step.kind !== 'subprocess' || inner === undefined) {
    return undefined;
  }
  const hasStart = inner.steps.some((item) => item.id === inner.startId);
  return hasStart ? inner : undefined;
}

/** Ação que resolve a etapa; `undefined` para a etapa que o motor atravessa sozinho ou em que a ficha só espera. */
export function resolutionOf(step: PlanStep): StepResolution | undefined {
  if (COMPLETE_KINDS.includes(step.kind)) {
    return 'complete';
  }
  if (CHOOSE_KINDS.includes(step.kind)) {
    return 'choose';
  }
  if (step.kind === 'subprocess' && innerPlanOf(step) === undefined) {
    return 'complete';
  }
  return undefined;
}

/** Junção: a ficha que chega espera os outros caminhos. */
export function isJoin(step: PlanStep): boolean {
  return step.kind === 'parallel-join' || step.kind === 'inclusive-join';
}

/**
 * Saídas que `choose` aceita na etapa. A espera por evento só oferece o prazo expirado quando tem prazo; a etapa que
 * não é de escolha não oferece nenhuma.
 */
export function choicesOf(step: PlanStep): readonly PlanExit[] {
  if (resolutionOf(step) !== 'choose') {
    return [];
  }
  if (step.kind === 'wait-event' && step.deadline === undefined) {
    return step.exits.filter((exit) => exit.meaning !== 'expired');
  }
  return step.exits;
}

/** Diz se a escolha aceita mais de uma saída; só a decisão inclusiva aceita. */
export function allowsManyChoices(step: PlanStep): boolean {
  return step.kind === 'inclusive-split';
}

const MEANING_TEXT: Readonly<Record<ExitMeaning, string>> = {
  next: 'Seguir',
  branch: 'Ramo',
  received: 'Evento recebido',
  expired: 'Prazo expirado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

/** Nome da saída no histórico: o rótulo dela ou, sem rótulo, o que ela significa. */
export function exitName(exit: PlanExit): string {
  return exit.label?.trim() || MEANING_TEXT[exit.meaning];
}

const TRIGGER_TEXT: Readonly<Record<PlanEventTrigger, string>> = {
  error: 'Erro técnico',
  timeout: 'Tempo esgotado',
};

/** Nome da exceção no histórico: o rótulo dela ou, sem rótulo, o gatilho. */
export function eventName(event: PlanEvent): string {
  return event.label.trim() || TRIGGER_TEXT[event.trigger];
}

/** Caminho por onde uma ficha sai da etapa: uma saída ou uma exceção presa a ela. */
export type Way = Pick<PlanExit, 'id' | 'to'>;

/** Todos os caminhos de saída da etapa: as saídas e as exceções. */
export function waysOf(step: PlanStep): readonly Way[] {
  return [...step.exits, ...(step.events ?? [])];
}

/** Como a ficha está parada: esperando uma ação, numa junção ou marcando um subprocesso em andamento. */
export type TokenState = 'pending' | 'waiting' | 'scope';

export function tokenState(token: RunToken): TokenState {
  if (token.waiting) {
    return 'waiting';
  }
  return token.scope ? 'scope' : 'pending';
}

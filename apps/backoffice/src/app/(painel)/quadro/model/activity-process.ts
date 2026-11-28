import type { ProcessRun, RunEvent } from '@/shared/process/run';

import type { BoardCard, CardActivity, ProcessActivity } from './board';
import { sameRun } from './board-processes';

/** Diz se o registro é do processo do card. */
export function isProcessActivity(
  entry: CardActivity,
): entry is ProcessActivity {
  return entry.kind.startsWith('process-');
}

interface RunEntryParams {
  readonly run: ProcessRun;
  readonly event: RunEvent;
  readonly at: string;
}

/** O registro do histórico do card para um evento da execução; `undefined` para o que o histórico não conta. */
function entryOf(params: RunEntryParams): ProcessActivity | undefined {
  const { run, event, at } = params;
  switch (event.kind) {
    case 'step':
    case 'choice':
    case 'approval':
    case 'event':
      return {
        at,
        kind: 'process-step',
        step: event.label,
        detail: event.detail,
      };
    case 'finished':
      return {
        at,
        kind: 'process-finished',
        name: run.name,
        outcome: run.outcome?.label,
      };
    case 'cancelled':
      return { at, kind: 'process-cancelled', name: run.name };
    default:
      // NOTE: o início vira "processo iniciado" pela troca de execução; a delegação aparece no card filho criado, e
      // o caminho encerrado, no desfecho do processo.
      return undefined;
  }
}

interface RunPair {
  readonly before: ProcessRun;
  readonly after: ProcessRun;
}

/** Eventos que a execução ganhou; o motor só acrescenta ao log, então o evento que já existia é o mesmo objeto. */
function newEvents(pair: RunPair): readonly RunEvent[] {
  const known = new Set(pair.before.log);
  return pair.after.log.filter((event) => !known.has(event));
}

interface RunEntriesParams {
  readonly run: ProcessRun;
  readonly events: readonly RunEvent[];
  readonly at: string;
}

function entriesOf(params: RunEntriesParams): readonly ProcessActivity[] {
  const { run, events, at } = params;
  const entries: ProcessActivity[] = [];
  for (const event of events) {
    const entry = entryOf({ run, event, at });
    if (entry) {
      entries.push(entry);
    }
  }
  return entries;
}

export interface ProcessChangesParams {
  readonly before: BoardCard;
  readonly after: BoardCard;
  /** Data e hora da mudança, ISO 8601. */
  readonly at: string;
}

/**
 * O que mudou no processo do card, na ordem em que entra no histórico: processo removido, processo iniciado, cada
 * etapa resolvida (com o ramo, o desfecho ou a exceção), processo concluído e processo cancelado.
 */
export function processChanges(
  params: ProcessChangesParams,
): readonly CardActivity[] {
  const { at } = params;
  const before = params.before.process;
  const after = params.after.process;
  if (before === after) {
    return [];
  }
  if (before && after && sameRun(before, after)) {
    const events = newEvents({ before, after });
    return entriesOf({ run: after, events, at });
  }
  const changes: CardActivity[] = [];
  if (before && !after) {
    changes.push({ at, kind: 'process-removed', name: before.name });
  }
  if (after) {
    changes.push({ at, kind: 'process-started', name: after.name });
    // NOTE: a execução nova já pode ter andado sozinha até o fim, quando o roteiro não tem etapa que espere alguém.
    changes.push(...entriesOf({ run: after, events: after.log, at }));
  }
  return changes;
}

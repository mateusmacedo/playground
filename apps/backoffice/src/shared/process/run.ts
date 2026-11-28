import { type FieldEntry, parseEntries } from './fields';
import type { ExitKey, PlanOutcome, StepRef } from './plan';
import { parseOutcome } from './plan-parse';
import {
  allValid,
  isCount,
  isFilledText,
  isPositiveInteger,
  isRecord,
  isTimestamp,
  keepValid,
  knownOption,
  optionalText,
} from './stored-values';

export type RunStatus = 'running' | 'completed' | 'cancelled';

/** Ficha: marca um ponto em que a execução está parada. */
export interface RunToken {
  readonly id: string;
  readonly stepRef: StepRef;
  /** Quando a ficha chegou à etapa (ISO 8601). */
  readonly since: string;
  /** Parada numa junção, esperando os outros caminhos. */
  readonly waiting?: boolean;
  /** Marca o subprocesso em andamento: não é acionável, só recebe exceção. */
  readonly scope?: boolean;
  /** Id externo de quem executa a etapa; o quadro guarda aqui o card filho. */
  readonly delegateId?: string;
}

export type RunEventKind =
  | 'started'
  | 'step'
  | 'choice'
  | 'approval'
  | 'event'
  | 'path-ended'
  | 'finished'
  | 'cancelled'
  | 'delegated';

/** Entrada da trilha da execução. */
export interface RunEvent {
  readonly at: string;
  readonly kind: RunEventKind;
  readonly stepRef?: StepRef;
  /** Nome da etapa ou, sem etapa, do que aconteceu. */
  readonly label: string;
  /** Ramo escolhido, desfecho ou observação do motor, como "antes do previsto". */
  readonly detail?: string;
  /** Observação de quem agiu. */
  readonly note?: string;
  readonly by?: string;
  readonly values?: readonly FieldEntry[];
}

/** Desfecho da execução: o do último Fim alcançado. */
export type RunOutcome = PlanOutcome;

/** Execução de uma versão publicada de um processo. */
export interface ProcessRun {
  readonly definitionId: string;
  /** Versão em que a execução começou; ela não muda de versão. */
  readonly version: number;
  readonly name: string;
  readonly status: RunStatus;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly tokens: readonly RunToken[];
  readonly log: readonly RunEvent[];
  /** Número da próxima ficha a criar. */
  readonly nextToken: number;
  readonly outcome?: RunOutcome;
  /**
   * Saídas já percorridas, sem repetição. Fica fora do log porque ele é podado e nem todo passo vira entrada dele;
   * é daqui que saem as etapas concluídas e os caminhos percorridos do diagrama.
   */
  readonly takenExits: readonly ExitKey[];
}

/** Máximo de entradas do log de uma execução. */
export const RUN_LOG_LIMIT = 300;

function capLog(log: readonly RunEvent[]): readonly RunEvent[] {
  if (log.length <= RUN_LOG_LIMIT) {
    return log;
  }
  const first = log.slice(0, 1);
  const recent = log.slice(log.length - RUN_LOG_LIMIT + 1);
  return [...first, ...recent];
}

export interface AppendLogParams {
  readonly log: readonly RunEvent[];
  readonly events: readonly RunEvent[];
}

/**
 * Log com os eventos novos no fim, dentro do limite: ao passar, saem os mais antigos depois do primeiro, que é o
 * início da execução.
 */
export function appendLog(params: AppendLogParams): readonly RunEvent[] {
  const { log, events } = params;
  return capLog([...log, ...events]);
}

const STATUSES: readonly RunStatus[] = ['running', 'completed', 'cancelled'];

const EVENT_KINDS: readonly RunEventKind[] = [
  'started',
  'step',
  'choice',
  'approval',
  'event',
  'path-ended',
  'finished',
  'cancelled',
  'delegated',
];

function toToken(value: unknown): RunToken | null {
  if (
    !isRecord(value) ||
    !isFilledText(value.id) ||
    !isFilledText(value.stepRef) ||
    !isTimestamp(value.since)
  ) {
    return null;
  }
  return {
    id: value.id,
    stepRef: value.stepRef,
    since: value.since,
    waiting: value.waiting === true ? true : undefined,
    scope: value.scope === true ? true : undefined,
    delegateId: optionalText(value.delegateId),
  };
}

function toEvent(value: unknown): RunEvent | null {
  if (
    !isRecord(value) ||
    !isTimestamp(value.at) ||
    typeof value.label !== 'string'
  ) {
    return null;
  }
  const kind = knownOption({ value: value.kind, options: EVENT_KINDS });
  if (kind === undefined) {
    return null;
  }
  return {
    at: value.at,
    kind,
    stepRef: optionalText(value.stepRef),
    label: value.label,
    detail: optionalText(value.detail),
    note: optionalText(value.note),
    by: optionalText(value.by),
    values: parseEntries(value.values),
  };
}

function toExitKey(value: unknown): ExitKey | null {
  return isFilledText(value) ? value : null;
}

function toTakenExits(value: unknown): readonly ExitKey[] {
  const keys = keepValid({ value, parse: toExitKey }) ?? [];
  return [...new Set(keys)];
}

/**
 * Lê uma execução vinda do armazenamento. Identificação, situação e fichas são lidas à risca, porque definem onde a
 * execução está: qualquer uma ilegível, ou ficha de id repetido, invalida a execução (`undefined`). O resto é lido
 * campo a campo: entrada de log ilegível, desfecho e saída percorrida fora do formato são descartados, e o log volta
 * ao limite.
 */
export function parseRun(value: unknown): ProcessRun | undefined {
  if (
    !isRecord(value) ||
    !isFilledText(value.definitionId) ||
    !isPositiveInteger(value.version) ||
    typeof value.name !== 'string' ||
    !isTimestamp(value.startedAt) ||
    !isCount(value.nextToken)
  ) {
    return undefined;
  }
  const status = knownOption({ value: value.status, options: STATUSES });
  const tokens = allValid({ value: value.tokens, parse: toToken });
  if (status === undefined || tokens === null) {
    return undefined;
  }
  const log = keepValid({ value: value.log, parse: toEvent }) ?? [];
  return {
    definitionId: value.definitionId,
    version: value.version,
    name: value.name,
    status,
    startedAt: value.startedAt,
    endedAt: isTimestamp(value.endedAt) ? value.endedAt : undefined,
    tokens,
    log: capLog(log),
    nextToken: value.nextToken,
    outcome: parseOutcome(value.outcome),
    takenExits: toTakenExits(value.takenExits),
  };
}

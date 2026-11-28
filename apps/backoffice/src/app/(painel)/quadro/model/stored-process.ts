import { parsePlan } from '@/shared/process/plan-parse';
import { parseRun } from '@/shared/process/run';
import {
  isFilledText,
  isPositiveInteger,
  isRecord,
  keepValid,
  type UnknownRecord,
} from '@/shared/process/stored-values';

import type {
  BoardCard,
  BoardProcess,
  BoardRules,
  CardStepLink,
} from './board';
import { processKey } from './board-processes';
import { cleanRules } from './rules';

/** Regras gravadas; o que não for um objeto vale como nenhuma regra ligada. */
export function toRules(value: unknown): BoardRules | undefined {
  return isRecord(value) ? cleanRules(value) : undefined;
}

function toStepLink(value: unknown): CardStepLink | undefined {
  if (
    !isRecord(value) ||
    !isFilledText(value.cardId) ||
    !isFilledText(value.tokenId)
  ) {
    return undefined;
  }
  return { cardId: value.cardId, tokenId: value.tokenId };
}

function toCardId(value: unknown): string | null {
  return isFilledText(value) ? value : null;
}

/** Ids dos bloqueadores, sem repetição; `undefined` sem nenhum. */
function toBlockedBy(value: unknown): readonly string[] | undefined {
  const ids = keepValid({ value, parse: toCardId });
  return ids ? [...new Set(ids)] : undefined;
}

/** O que o card guarda do processo e das dependências. */
export type ProcessCardData = Pick<
  BoardCard,
  'process' | 'blockedBy' | 'stepOf'
>;

/**
 * Lê do card gravado a execução do processo, os bloqueadores e a etapa que ele executa. Cada um fora do formato é
 * descartado sem invalidar o card; o quadro gravado antes de existirem volta sem eles.
 */
export function processCardData(value: UnknownRecord): ProcessCardData {
  return {
    process: parseRun(value.process),
    blockedBy: toBlockedBy(value.blockedBy),
    stepOf: toStepLink(value.stepOf),
  };
}

function toBoardProcess(value: unknown): BoardProcess | null {
  if (
    !isRecord(value) ||
    !isFilledText(value.definitionId) ||
    !isPositiveInteger(value.version) ||
    typeof value.name !== 'string'
  ) {
    return null;
  }
  const plan = parsePlan(value.plan);
  if (!plan) {
    return null;
  }
  return {
    definitionId: value.definitionId,
    version: value.version,
    name: value.name,
    plan,
  };
}

/** Roteiros gravados no quadro, um por versão de processo: o primeiro de cada versão fica. */
export function toProcesses(
  value: unknown,
): readonly BoardProcess[] | undefined {
  const processes = keepValid({ value, parse: toBoardProcess });
  if (!processes) {
    return undefined;
  }
  const seen = new Set<string>();
  const unique: BoardProcess[] = [];
  for (const process of processes) {
    const key = processKey(process);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(process);
    }
  }
  return unique;
}

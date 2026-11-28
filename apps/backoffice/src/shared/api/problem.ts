import {
  isFilledText,
  isRecord,
  optionalText,
} from '@/shared/process/stored-values';

/** Erro que a API devolve em `application/problem+json`. */
export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
}

export interface ProblemSource {
  /** Corpo da resposta de erro, já lido como JSON. */
  readonly body: unknown;
  /** Status HTTP da resposta, que vale quando o corpo não traz o dele. */
  readonly status: number;
}

/** O tipo que o formato define para o problema que não informa o próprio. */
const UNTYPED_PROBLEM = 'about:blank';

/**
 * Lê o problema do corpo de uma resposta de erro; `null` quando o corpo não é um objeto com título. O tipo e o status
 * que faltarem saem do padrão do formato e do status da resposta, para um servidor fora do contrato não esconder o
 * título que mandou.
 */
export function parseProblem(source: ProblemSource): Problem | null {
  const { body, status } = source;
  if (!isRecord(body) || !isFilledText(body.title)) {
    return null;
  }
  const ownStatus = body.status;
  const hasOwnStatus =
    typeof ownStatus === 'number' && Number.isInteger(ownStatus);
  return {
    type: optionalText(body.type) ?? UNTYPED_PROBLEM,
    title: body.title,
    status: hasOwnStatus ? ownStatus : status,
    detail: optionalText(body.detail),
    instance: optionalText(body.instance),
  };
}

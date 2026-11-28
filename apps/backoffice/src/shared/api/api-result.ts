import type { Problem } from './problem';

/** Por que a chamada falhou, para quem chama decidir o que fazer; a mensagem é o texto para a pessoa. */
export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'not-found'
  | 'conflict'
  | 'invalid'
  | 'server'
  | 'unexpected';

export interface ApiError {
  readonly kind: ApiErrorKind;
  /** Texto em PT-BR, pronto para a tela. */
  readonly message: string;
  /** Status HTTP, quando o servidor chegou a responder. */
  readonly status?: number;
  /** O problema que o servidor descreveu, para diagnóstico; o texto de tela é `message`. */
  readonly problem?: Problem;
}

export interface ApiSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface ApiFailure {
  readonly ok: false;
  readonly error: ApiError;
}

/** Resultado de uma chamada à API: o valor ou o erro, nunca uma exceção. */
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** O texto de tela de cada caso de erro. */
export const API_ERROR_MESSAGES: Readonly<Record<ApiErrorKind, string>> = {
  network:
    'Não foi possível falar com o servidor. Confira a conexão e tente de novo.',
  timeout: 'O servidor demorou demais para responder. Tente de novo.',
  'not-found':
    'Este item não está mais no servidor. Ele pode ter sido removido.',
  conflict: 'Este item foi alterado em outro lugar depois que você o abriu.',
  invalid: 'O servidor recusou os dados enviados.',
  server: 'O servidor encontrou um problema. Tente de novo em instantes.',
  unexpected: 'O servidor deu uma resposta inesperada.',
};

const KIND_BY_STATUS: ReadonlyMap<number, ApiErrorKind> = new Map([
  [400, 'invalid'],
  [404, 'not-found'],
  [412, 'conflict'],
  [422, 'invalid'],
  [428, 'invalid'],
]);

const FIRST_SERVER_STATUS = 500;

/** O caso de erro de um status HTTP que não é de sucesso. */
export function kindOfStatus(status: number): ApiErrorKind {
  const known = KIND_BY_STATUS.get(status);
  if (known !== undefined) {
    return known;
  }
  return status >= FIRST_SERVER_STATUS ? 'server' : 'unexpected';
}

export function succeeded<T>(value: T): ApiSuccess<T> {
  return { ok: true, value };
}

export interface FailureParams {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly problem?: Problem;
}

export function failed(params: FailureParams): ApiFailure {
  const { kind, status, problem } = params;
  return {
    ok: false,
    error: { kind, message: API_ERROR_MESSAGES[kind], status, problem },
  };
}

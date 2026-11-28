import { etagOfRevision } from './http-client';

export interface ApiResponseParams {
  readonly status?: number;
  /** Corpo, enviado como JSON; sem ele, a resposta sai sem corpo. */
  readonly body?: unknown;
  /** Revisão que vai no `ETag`; sem ela, a resposta sai sem o cabeçalho. */
  readonly revision?: number;
  readonly contentType?: string;
}

/** Resposta como as da API, para o `fetch` simulado de um teste. */
export function apiResponse(params: ApiResponseParams = {}): Response {
  const { status = 200, body, revision } = params;
  const headers: Record<string, string> = {};
  if (revision !== undefined) {
    headers.ETag = etagOfRevision(revision);
  }
  if (body === undefined) {
    return new Response(null, { status, headers });
  }
  headers['Content-Type'] = params.contentType ?? 'application/json';
  return new Response(JSON.stringify(body), { status, headers });
}

/** Uma chamada que o `fetch` simulado recebeu, já no formato em que o teste confere. */
export interface SentRequest {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: Readonly<Record<string, string>>;
  /** Corpo lido de volta do JSON enviado; `undefined` quando a chamada foi sem corpo. */
  readonly body: unknown;
}

/** Lê os argumentos de uma chamada ao `fetch` simulado, como `fetchMock.mock.calls[0]`. */
export function sentRequest(call: Parameters<typeof fetch>): SentRequest {
  const [input, init] = call;
  const text = init?.body;
  return {
    url: String(input),
    method: init?.method,
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
    body: typeof text === 'string' ? JSON.parse(text) : undefined,
  };
}

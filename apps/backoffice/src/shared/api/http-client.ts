import { type ApiResult, failed, kindOfStatus, succeeded } from './api-result';
import { parseProblem } from './problem';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface HttpRequest {
  readonly method: HttpMethod;
  /** Caminho a partir do endereço base, começando com `/`. */
  readonly path: string;
  /** Corpo, enviado como JSON. */
  readonly body?: unknown;
  /** Revisão lida do documento, enviada em `If-Match`. */
  readonly ifMatch?: number;
}

export interface HttpResponse {
  readonly status: number;
  /** Corpo lido como JSON; `undefined` quando a resposta veio sem corpo. */
  readonly body: unknown;
  /** Revisão lida do `ETag`; `null` sem o cabeçalho ou com ele fora do formato `"<inteiro>"`. */
  readonly revision: number | null;
}

export interface HttpClient {
  /** Faz a chamada e devolve a resposta de sucesso ou o erro tipado; não rejeita por falha de rede nem de servidor. */
  readonly request: (request: HttpRequest) => Promise<ApiResult<HttpResponse>>;
}

export interface HttpClientConfig {
  /** Endereço base da API, sem barra no fim. */
  readonly baseUrl: string;
  /** Tempo limite de cada chamada, em milissegundos. */
  readonly timeoutMs?: number;
  /** O `fetch` a usar no lugar do global. */
  readonly fetch?: typeof fetch;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

const ETAG_REVISION = /^(?:W\/)?"(\d+)"$/;

/** A revisão que um `ETag` no formato `"<inteiro>"` carrega; `null` para qualquer outro valor. */
export function revisionOfEtag(etag: string | null): number | null {
  if (etag === null) {
    return null;
  }
  const digits = ETAG_REVISION.exec(etag.trim())?.[1];
  if (digits === undefined) {
    return null;
  }
  const revision = Number(digits);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : null;
}

/** O valor de `ETag` e de `If-Match` de uma revisão. */
export function etagOfRevision(revision: number): string {
  return `"${revision}"`;
}

function toHeaders(request: HttpRequest): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json, application/problem+json',
  };
  if (request.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (request.ifMatch !== undefined) {
    headers['If-Match'] = etagOfRevision(request.ifMatch);
  }
  return headers;
}

interface InitParams {
  readonly request: HttpRequest;
  readonly signal: AbortSignal;
}

function toInit(params: InitParams): RequestInit {
  const { request, signal } = params;
  const hasBody = request.body !== undefined;
  return {
    method: request.method,
    headers: toHeaders(request),
    body: hasBody ? JSON.stringify(request.body) : undefined,
    signal,
    // WHY: o documento muda no servidor sem o endereço mudar; uma resposta guardada pelo navegador faria a releitura
    // devolver a revisão antiga.
    cache: 'no-store',
  };
}

interface ReadBody {
  /** O corpo estava vazio ou era JSON válido. */
  readonly readable: boolean;
  readonly value: unknown;
}

async function readBody(response: Response): Promise<ReadBody> {
  const text = await response.text();
  if (text.trim() === '') {
    return { readable: true, value: undefined };
  }
  try {
    return { readable: true, value: JSON.parse(text) };
  } catch {
    // WHY: corpo que não é JSON (página de erro de um proxy, por exemplo) não tem o que ser lido; quem decide o que
    // isso significa é o status da resposta.
    return { readable: false, value: undefined };
  }
}

interface ResultParams {
  readonly response: Response;
  readonly body: ReadBody;
}

function toResult(params: ResultParams): ApiResult<HttpResponse> {
  const { response, body } = params;
  const { status } = response;
  if (!response.ok) {
    const problem = parseProblem({ body: body.value, status });
    return failed({
      kind: kindOfStatus(status),
      status,
      problem: problem ?? undefined,
    });
  }
  if (!body.readable) {
    return failed({ kind: 'unexpected', status });
  }
  return succeeded({
    status,
    body: body.value,
    revision: revisionOfEtag(response.headers.get('ETag')),
  });
}

/**
 * Cliente HTTP da API do painel sobre o `fetch`: JSON na ida e na volta, tempo limite por chamada, a revisão do
 * documento lida do `ETag` e enviada em `If-Match`, e toda falha devolvida como erro tipado.
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  const { baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = config;
  // NOTE: o `fetch` global é lido a cada chamada, e não aqui, para valer o que estiver no lugar dele na hora.
  const send: typeof fetch =
    config.fetch ?? ((input, init) => globalThis.fetch(input, init));

  return {
    async request(request) {
      const controller = new AbortController();
      const init = toInit({ request, signal: controller.signal });
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await send(`${baseUrl}${request.path}`, init);
        const body = await readBody(response);
        return toResult({ response, body });
      } catch {
        // WHY: o `fetch` rejeita sem dizer o motivo (rede, DNS, CORS) e também quando é abortado; o que separa os
        // dois casos é o tempo limite deste cliente ter disparado. O erro em si não tem o que dizer ao usuário.
        return failed({
          kind: controller.signal.aborted ? 'timeout' : 'network',
        });
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

import type { ApiErrorKind } from './api-result';
import { apiResponse, sentRequest } from './api-test-kit';
import {
  createHttpClient,
  DEFAULT_TIMEOUT_MS,
  etagOfRevision,
  revisionOfEtag,
} from './http-client';

const BASE_URL = 'http://127.0.0.1:4010';

/** `fetch` que nunca responde e rejeita quando a chamada é abortada, como o do navegador. */
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('A chamada foi abortada.', 'AbortError'));
    });
  });

describe('revisionOfEtag', () => {
  it.each([
    ['"3"', 3],
    ['W/"12"', 12],
    [' "7" ', 7],
  ])('lê a revisão de %s', (etag, revision) => {
    expect(revisionOfEtag(etag)).toBe(revision);
  });

  it.each([
    ['sem o cabeçalho', null],
    ['vazio', '""'],
    ['sem aspas', '3'],
    ['que não é número', '"abc"'],
    ['zero', '"0"'],
    ['grande demais para um inteiro', `"${'9'.repeat(30)}"`],
  ])('não lê revisão de um ETag %s', (_caso, etag) => {
    expect(revisionOfEtag(etag)).toBeNull();
  });
});

describe('etagOfRevision', () => {
  it('põe a revisão entre aspas', () => {
    expect(etagOfRevision(4)).toBe('"4"');
  });
});

describe('createHttpClient', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('chama o endereço base com o caminho, pedindo JSON e sem usar resposta guardada', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      apiResponse({ body: [] }),
    );
    const client = createHttpClient({ baseUrl: BASE_URL, fetch: fetchMock });

    await client.request({ method: 'GET', path: '/boards' });

    const [call] = fetchMock.mock.calls;
    expect(sentRequest(call)).toEqual({
      url: 'http://127.0.0.1:4010/boards',
      method: 'GET',
      headers: { accept: 'application/json, application/problem+json' },
      body: undefined,
    });
    expect(call[1]?.cache).toBe('no-store');
  });

  it('envia o corpo como JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      apiResponse({ body: {} }),
    );
    const client = createHttpClient({ baseUrl: BASE_URL, fetch: fetchMock });

    await client.request({
      method: 'POST',
      path: '/boards',
      body: { id: 'board-2', name: 'Vendas' },
    });

    const sent = sentRequest(fetchMock.mock.calls[0]);
    expect(sent.headers['content-type']).toBe('application/json');
    expect(sent.body).toEqual({ id: 'board-2', name: 'Vendas' });
  });

  it('envia em If-Match a revisão lida, entre aspas', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      apiResponse({ body: {} }),
    );
    const client = createHttpClient({ baseUrl: BASE_URL, fetch: fetchMock });

    await client.request({
      method: 'PUT',
      path: '/boards/board-1',
      body: {},
      ifMatch: 3,
    });

    expect(sentRequest(fetchMock.mock.calls[0]).headers['if-match']).toBe(
      '"3"',
    );
  });

  it('não envia If-Match numa chamada sem revisão', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      apiResponse({ body: {} }),
    );
    const client = createHttpClient({ baseUrl: BASE_URL, fetch: fetchMock });

    await client.request({ method: 'GET', path: '/boards/board-1' });

    expect(sentRequest(fetchMock.mock.calls[0]).headers).not.toHaveProperty(
      'if-match',
    );
  });

  it('devolve o status, o corpo e a revisão do ETag de uma resposta de sucesso', async () => {
    const body = { id: 'board-1', revision: 3 };
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetch: async () => apiResponse({ status: 201, body, revision: 3 }),
    });

    const result = await client.request({ method: 'GET', path: '/boards/x' });

    expect(result).toEqual({
      ok: true,
      value: { status: 201, body, revision: 3 },
    });
  });

  it('fica sem revisão quando a resposta não traz ETag', async () => {
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetch: async () => apiResponse({ body: [] }),
    });

    const result = await client.request({ method: 'GET', path: '/boards' });

    expect(result).toEqual({
      ok: true,
      value: { status: 200, body: [], revision: null },
    });
  });

  it('aceita a resposta de sucesso sem corpo', async () => {
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetch: async () => apiResponse({ status: 204 }),
    });

    const result = await client.request({
      method: 'DELETE',
      path: '/boards/board-1',
    });

    expect(result).toEqual({
      ok: true,
      value: { status: 204, body: undefined, revision: null },
    });
  });

  it('trata como inesperada a resposta de sucesso que não é JSON', async () => {
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetch: async () => new Response('<html>ok</html>', { status: 200 }),
    });

    const result = await client.request({ method: 'GET', path: '/boards' });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'unexpected', status: 200 },
    });
  });

  it.each<[number, ApiErrorKind, string]>([
    [404, 'not-found', 'Este item não está mais no servidor'],
    [412, 'conflict', 'Este item foi alterado em outro lugar'],
    [400, 'invalid', 'O servidor recusou os dados enviados.'],
    [422, 'invalid', 'O servidor recusou os dados enviados.'],
    [428, 'invalid', 'O servidor recusou os dados enviados.'],
    [500, 'server', 'O servidor encontrou um problema'],
    [503, 'server', 'O servidor encontrou um problema'],
    [401, 'unexpected', 'O servidor deu uma resposta inesperada.'],
  ])(
    'devolve o status %i como o erro %s, com o texto de tela',
    async (status, kind, message) => {
      const client = createHttpClient({
        baseUrl: BASE_URL,
        fetch: async () => apiResponse({ status }),
      });

      const result = await client.request({ method: 'GET', path: '/boards/x' });

      expect(result).toMatchObject({ ok: false, error: { kind, status } });
      expect(result.ok ? '' : result.error.message).toContain(message);
    },
  );

  it('lê o problema que veio no corpo do erro', async () => {
    const problem = {
      type: 'https://api.exemplo.test/problemas/revisao',
      title: 'Revisão desatualizada',
      status: 412,
      detail: 'O quadro está na revisão 4.',
    };
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetch: async () =>
        apiResponse({
          status: 412,
          body: problem,
          contentType: 'application/problem+json',
        }),
    });

    const result = await client.request({ method: 'PUT', path: '/boards/x' });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'conflict', status: 412, problem },
    });
  });

  it('fica sem problema quando o corpo do erro não é JSON', async () => {
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetch: async () => new Response('Bad Gateway', { status: 502 }),
    });

    const result = await client.request({ method: 'GET', path: '/boards' });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'server', status: 502 },
    });
    expect(result.ok ? null : result.error.problem).toBeUndefined();
  });

  it('devolve a falha do fetch como erro de rede', async () => {
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
    });

    const result = await client.request({ method: 'GET', path: '/boards' });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'network',
        message:
          'Não foi possível falar com o servidor. Confira a conexão e tente de novo.',
      },
    });
  });

  it('devolve como erro de rede a resposta que cai no meio da leitura do corpo', async () => {
    const broken = apiResponse({ body: {} });
    vi.spyOn(broken, 'text').mockRejectedValue(new TypeError('terminated'));
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetch: async () => broken,
    });

    const result = await client.request({ method: 'GET', path: '/boards' });

    expect(result).toMatchObject({ ok: false, error: { kind: 'network' } });
  });

  it('aborta a chamada e devolve tempo esgotado quando o servidor passa do limite', async () => {
    vi.useFakeTimers();
    const client = createHttpClient({
      baseUrl: BASE_URL,
      timeoutMs: 2_000,
      fetch: hangingFetch,
    });

    const pending = client.request({ method: 'GET', path: '/boards' });
    await vi.advanceTimersByTimeAsync(2_000);

    expect(await pending).toEqual({
      ok: false,
      error: {
        kind: 'timeout',
        message: 'O servidor demorou demais para responder. Tente de novo.',
      },
    });
  });

  it('espera 10 segundos quando nenhum limite é informado', async () => {
    vi.useFakeTimers();
    const settled = vi.fn();
    const client = createHttpClient({ baseUrl: BASE_URL, fetch: hangingFetch });

    client.request({ method: 'GET', path: '/boards' }).then(settled);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 1);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
    expect(settled).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false }),
    );
  });

  it('desliga o temporizador do limite quando a resposta chega', async () => {
    vi.useFakeTimers();
    const client = createHttpClient({
      baseUrl: BASE_URL,
      fetch: async () => apiResponse({ body: [] }),
    });

    await client.request({ method: 'GET', path: '/boards' });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('usa o fetch global quando nenhum é informado', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      apiResponse({ body: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = createHttpClient({ baseUrl: BASE_URL });

    const result = await client.request({ method: 'GET', path: '/boards' });

    expect(result.ok).toBe(true);
    expect(sentRequest(fetchMock.mock.calls[0]).url).toBe(
      'http://127.0.0.1:4010/boards',
    );
  });
});

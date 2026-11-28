import { apiResponse, sentRequest } from './api-test-kit';
import { createPanelApi } from './panel-api';

describe('createPanelApi', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sem endereço, não há API', () => {
    expect(createPanelApi({ baseUrl: null })).toBeNull();
  });

  it('com endereço, entrega os quadros e as definições de processo nesse endereço', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      apiResponse({ body: [] }),
    );
    const api = createPanelApi({
      baseUrl: 'https://api.exemplo.test/painel',
      fetch: fetchMock,
    });

    await api?.boards.list();
    await api?.processDefinitions.list();

    const urls = fetchMock.mock.calls.map((call) => sentRequest(call).url);
    expect(urls).toEqual([
      'https://api.exemplo.test/painel/boards',
      'https://api.exemplo.test/painel/process-definitions',
    ]);
  });

  it('repassa o tempo limite às chamadas', async () => {
    vi.useFakeTimers();
    const api = createPanelApi({
      baseUrl: 'https://api.exemplo.test',
      timeoutMs: 500,
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error()));
        }),
    });

    const pending = api?.boards.list();
    await vi.advanceTimersByTimeAsync(500);

    expect(await pending).toMatchObject({
      ok: false,
      error: { kind: 'timeout' },
    });
  });
});

describe('CONFIGURED_PANEL_API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('sem NEXT_PUBLIC_API_URL, o painel fica sem API', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    vi.resetModules();

    const loaded = await import('./panel-api');

    expect(loaded.CONFIGURED_PANEL_API).toBeNull();
  });

  it('com NEXT_PUBLIC_API_URL, chama o endereço configurado', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      apiResponse({ body: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:4010/');
    vi.resetModules();

    const loaded = await import('./panel-api');
    await loaded.CONFIGURED_PANEL_API?.boards.list();

    expect(sentRequest(fetchMock.mock.calls[0]).url).toBe(
      'http://127.0.0.1:4010/boards',
    );
  });
});

import { apiResponse, sentRequest } from './api-test-kit';
import { type BoardsApi, createBoardsApi } from './boards-api';
import type { BoardDocument } from './contract';
import { createHttpClient } from './http-client';

const BASE_URL = 'http://127.0.0.1:4010';

const document: BoardDocument = {
  id: 'board-1',
  name: 'Quadro principal',
  revision: 3,
  schemaVersion: 3,
  board: { lanes: [{ id: 'lane-1', title: 'A fazer', cards: [] }] },
};

interface Setup {
  readonly fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly boards: BoardsApi;
}

function setup(response: Response): Setup {
  const fetchMock = vi.fn<typeof fetch>(async () => response);
  const client = createHttpClient({ baseUrl: BASE_URL, fetch: fetchMock });
  return { fetchMock, boards: createBoardsApi(client) };
}

describe('createBoardsApi', () => {
  it('lista o resumo de cada quadro, sem o conteúdo', async () => {
    const other = { ...document, id: 'board-2', name: 'Vendas', revision: 1 };
    const { fetchMock, boards } = setup(
      apiResponse({ body: [document, other] }),
    );

    const result = await boards.list();

    expect(sentRequest(fetchMock.mock.calls[0])).toMatchObject({
      url: 'http://127.0.0.1:4010/boards',
      method: 'GET',
    });
    expect(result).toEqual({
      ok: true,
      value: [
        { id: 'board-1', name: 'Quadro principal', revision: 3 },
        { id: 'board-2', name: 'Vendas', revision: 1 },
      ],
    });
  });

  it.each([
    ['sem id', { name: 'Vendas', revision: 1 }],
    ['sem nome', { id: 'board-2', name: ' ', revision: 1 }],
    ['sem revisão', { id: 'board-2', name: 'Vendas' }],
    ['que não é objeto', 'board-2'],
  ])('deixa fora da lista o quadro %s', async (_caso, broken) => {
    const { boards } = setup(apiResponse({ body: [broken, document] }));

    const result = await boards.list();

    expect(result).toEqual({
      ok: true,
      value: [{ id: 'board-1', name: 'Quadro principal', revision: 3 }],
    });
  });

  it('cria o quadro na revisão 1', async () => {
    const created = { ...document, revision: 1 };
    const { fetchMock, boards } = setup(
      apiResponse({ status: 201, body: created }),
    );

    const result = await boards.create({
      id: 'board-1',
      name: 'Quadro principal',
      schemaVersion: 3,
      board: document.board,
    });

    expect(sentRequest(fetchMock.mock.calls[0])).toMatchObject({
      url: 'http://127.0.0.1:4010/boards',
      method: 'POST',
      body: created,
    });
    expect(result).toEqual({ ok: true, value: created });
  });

  it('busca o quadro pelo id e entrega o conteúdo como veio', async () => {
    const { fetchMock, boards } = setup(
      apiResponse({ body: document, revision: 3 }),
    );

    const result = await boards.get('board-1');

    expect(sentRequest(fetchMock.mock.calls[0])).toMatchObject({
      url: 'http://127.0.0.1:4010/boards/board-1',
      method: 'GET',
    });
    expect(result).toEqual({ ok: true, value: document });
  });

  it('trata como inesperado o quadro que veio sem nome', async () => {
    const nameless = { ...document, name: undefined };
    const { boards } = setup(apiResponse({ body: nameless }));

    const result = await boards.get('board-1');

    expect(result).toMatchObject({ ok: false, error: { kind: 'unexpected' } });
  });

  it('regrava o quadro com a revisão lida em If-Match e devolve a seguinte', async () => {
    const renamed = { ...document, name: 'Operação' };
    const saved = { ...renamed, revision: 4 };
    const { fetchMock, boards } = setup(apiResponse({ body: saved }));

    const result = await boards.update(renamed);

    const sent = sentRequest(fetchMock.mock.calls[0]);
    expect(sent).toMatchObject({
      url: 'http://127.0.0.1:4010/boards/board-1',
      method: 'PUT',
      body: saved,
    });
    expect(sent.headers['if-match']).toBe('"3"');
    expect(result).toEqual({ ok: true, value: saved });
  });

  it('devolve conflito quando o quadro foi regravado em outro lugar', async () => {
    const { boards } = setup(apiResponse({ status: 412 }));

    const result = await boards.update(document);

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'conflict',
        message:
          'Este item foi alterado em outro lugar depois que você o abriu.',
      },
    });
  });

  it('apaga o quadro pelo id', async () => {
    const { fetchMock, boards } = setup(apiResponse({ status: 204 }));

    const result = await boards.remove('board-1');

    expect(sentRequest(fetchMock.mock.calls[0])).toMatchObject({
      url: 'http://127.0.0.1:4010/boards/board-1',
      method: 'DELETE',
    });
    expect(result.ok).toBe(true);
  });
});

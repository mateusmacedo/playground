import { apiResponse, sentRequest } from './api-test-kit';
import type { ProcessDefinitionDocument } from './contract';
import { createHttpClient } from './http-client';
import {
  createProcessDefinitionsApi,
  type ProcessDefinitionsApi,
} from './process-definitions-api';

const BASE_URL = 'http://127.0.0.1:4010';

const document: ProcessDefinitionDocument = {
  id: 'process-1',
  revision: 2,
  schemaVersion: 1,
  definition: {
    id: 'process-1',
    name: 'Atendimento',
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
    draftText: null,
    versions: [],
  },
};

interface Setup {
  readonly fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly definitions: ProcessDefinitionsApi;
}

function setup(response: Response): Setup {
  const fetchMock = vi.fn<typeof fetch>(async () => response);
  const client = createHttpClient({ baseUrl: BASE_URL, fetch: fetchMock });
  return { fetchMock, definitions: createProcessDefinitionsApi(client) };
}

describe('createProcessDefinitionsApi', () => {
  it('lista os documentos inteiros', async () => {
    const other = { ...document, id: 'process-2', revision: 1 };
    const { fetchMock, definitions } = setup(
      apiResponse({ body: [document, other] }),
    );

    const result = await definitions.list();

    expect(sentRequest(fetchMock.mock.calls[0])).toMatchObject({
      url: 'http://127.0.0.1:4010/process-definitions',
      method: 'GET',
    });
    expect(result).toEqual({ ok: true, value: [document, other] });
  });

  it('deixa fora da lista o documento sem revisão, mesmo com ETag na resposta', async () => {
    const broken = { id: 'process-9', schemaVersion: 1, definition: {} };
    const { definitions } = setup(
      apiResponse({ body: [broken, document], revision: 4 }),
    );

    const result = await definitions.list();

    expect(result).toEqual({ ok: true, value: [document] });
  });

  it('cria o processo na revisão 1', async () => {
    const created = { ...document, revision: 1 };
    const { fetchMock, definitions } = setup(
      apiResponse({ status: 201, body: created }),
    );

    const result = await definitions.create({
      id: 'process-1',
      schemaVersion: 1,
      definition: document.definition,
    });

    expect(sentRequest(fetchMock.mock.calls[0])).toMatchObject({
      url: 'http://127.0.0.1:4010/process-definitions',
      method: 'POST',
      body: created,
    });
    expect(result).toEqual({ ok: true, value: created });
  });

  it('busca o processo pelo id e entrega a definição como veio', async () => {
    const { fetchMock, definitions } = setup(
      apiResponse({ body: document, revision: 2 }),
    );

    const result = await definitions.get('process-1');

    expect(sentRequest(fetchMock.mock.calls[0])).toMatchObject({
      url: 'http://127.0.0.1:4010/process-definitions/process-1',
      method: 'GET',
    });
    expect(result).toEqual({ ok: true, value: document });
  });

  it('trata como inesperado o processo que veio sem a versão do formato', async () => {
    const { definitions } = setup(
      apiResponse({ body: { id: 'process-1', revision: 2, definition: {} } }),
    );

    const result = await definitions.get('process-1');

    expect(result).toMatchObject({ ok: false, error: { kind: 'unexpected' } });
  });

  it('regrava o processo com a revisão lida em If-Match e devolve a seguinte', async () => {
    const saved = { ...document, revision: 3 };
    const { fetchMock, definitions } = setup(apiResponse({ body: saved }));

    const result = await definitions.update(document);

    const sent = sentRequest(fetchMock.mock.calls[0]);
    expect(sent).toMatchObject({
      url: 'http://127.0.0.1:4010/process-definitions/process-1',
      method: 'PUT',
      body: saved,
    });
    expect(sent.headers['if-match']).toBe('"2"');
    expect(result).toEqual({ ok: true, value: saved });
  });

  it('não oferece remoção: o catálogo arquiva', () => {
    const { definitions } = setup(apiResponse());

    expect(definitions).not.toHaveProperty('remove');
  });
});

import { apiResponse, sentRequest } from './api-test-kit';
import {
  createDocumentResource,
  type DocumentResource,
  type EnvelopeSource,
  readEnvelope,
} from './document-resource';
import { createHttpClient } from './http-client';

const BASE_URL = 'http://127.0.0.1:4010';

interface NoteDocument {
  readonly id: string;
  readonly revision: number;
  readonly schemaVersion: number;
  readonly note: unknown;
}

function toNote(source: EnvelopeSource): NoteDocument | null {
  const envelope = readEnvelope(source);
  if (envelope === null) {
    return null;
  }
  return {
    id: envelope.id,
    revision: envelope.revision,
    schemaVersion: envelope.schemaVersion,
    note: envelope.fields.note,
  };
}

function toListedNote(value: unknown): NoteDocument | null {
  return toNote({ value, etagRevision: null });
}

const stored: NoteDocument = {
  id: 'note-1',
  revision: 3,
  schemaVersion: 2,
  note: { text: 'Ligar para o cliente' },
};

interface Setup {
  readonly fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly notes: DocumentResource<NoteDocument>;
}

function setup(response: Response): Setup {
  const fetchMock = vi.fn<typeof fetch>(async () => response);
  const client = createHttpClient({ baseUrl: BASE_URL, fetch: fetchMock });
  const notes = createDocumentResource({
    client,
    path: '/notes',
    read: toNote,
  });
  return { fetchMock, notes };
}

describe('readEnvelope', () => {
  it('lê o id, a revisão e a versão do formato, e entrega o objeto inteiro', () => {
    expect(readEnvelope({ value: stored, etagRevision: null })).toEqual({
      id: 'note-1',
      revision: 3,
      schemaVersion: 2,
      fields: stored,
    });
  });

  it('fica com a revisão do corpo quando o ETag traz outra', () => {
    const envelope = readEnvelope({ value: stored, etagRevision: 2 });

    expect(envelope?.revision).toBe(3);
  });

  it('usa a revisão do ETag quando o corpo não traz a dele', () => {
    const withoutRevision = { id: 'note-1', schemaVersion: 2, note: null };

    const envelope = readEnvelope({ value: withoutRevision, etagRevision: 5 });

    expect(envelope?.revision).toBe(5);
  });

  it.each([
    ['um valor que não é objeto', 'note-1'],
    ['um objeto sem id', { ...stored, id: '' }],
    [
      'uma versão do formato que não é inteira',
      { ...stored, schemaVersion: 1.5 },
    ],
    ['uma versão do formato em texto', { ...stored, schemaVersion: '2' }],
    ['uma revisão que não é inteiro positivo', { ...stored, revision: 0 }],
  ])('não lê o envelope de %s', (_caso, value) => {
    expect(readEnvelope({ value, etagRevision: null })).toBeNull();
  });
});

describe('createDocumentResource', () => {
  describe('list', () => {
    it('busca a coleção e lê cada item', async () => {
      const other = { ...stored, id: 'note-2', revision: 1 };
      const { fetchMock, notes } = setup(
        apiResponse({ body: [stored, other] }),
      );

      const result = await notes.list(toListedNote);

      expect(sentRequest(fetchMock.mock.calls[0])).toMatchObject({
        url: 'http://127.0.0.1:4010/notes',
        method: 'GET',
      });
      expect(result).toEqual({ ok: true, value: [stored, other] });
    });

    it('deixa de fora o item fora do contrato, sem derrubar os outros', async () => {
      const broken = { id: 'note-9' };
      const { notes } = setup(apiResponse({ body: [broken, stored] }));

      const result = await notes.list(toListedNote);

      expect(result).toEqual({ ok: true, value: [stored] });
    });

    it('trata como inesperada a resposta que não é uma lista', async () => {
      const { notes } = setup(apiResponse({ body: { items: [] } }));

      const result = await notes.list(toListedNote);

      expect(result).toMatchObject({
        ok: false,
        error: { kind: 'unexpected', status: 200 },
      });
    });

    it('repassa o erro da chamada', async () => {
      const { notes } = setup(apiResponse({ status: 503 }));

      const result = await notes.list(toListedNote);

      expect(result).toMatchObject({ ok: false, error: { kind: 'server' } });
    });
  });

  describe('create', () => {
    it('envia o documento novo na revisão 1 e devolve o que ficou gravado', async () => {
      const created = { ...stored, revision: 1 };
      const { fetchMock, notes } = setup(
        apiResponse({ status: 201, body: created }),
      );

      const result = await notes.create({
        id: 'note-1',
        schemaVersion: 2,
        note: stored.note,
      });

      expect(sentRequest(fetchMock.mock.calls[0])).toMatchObject({
        url: 'http://127.0.0.1:4010/notes',
        method: 'POST',
        body: created,
      });
      expect(result).toEqual({ ok: true, value: created });
    });
  });

  describe('get', () => {
    it('busca o documento pelo id', async () => {
      const { fetchMock, notes } = setup(
        apiResponse({ body: stored, revision: 3 }),
      );

      const result = await notes.get('note-1');

      expect(sentRequest(fetchMock.mock.calls[0])).toMatchObject({
        url: 'http://127.0.0.1:4010/notes/note-1',
        method: 'GET',
      });
      expect(result).toEqual({ ok: true, value: stored });
    });

    it('codifica o id no caminho', async () => {
      const { fetchMock, notes } = setup(apiResponse({ body: stored }));

      await notes.get('nota 1/2');

      expect(sentRequest(fetchMock.mock.calls[0]).url).toBe(
        'http://127.0.0.1:4010/notes/nota%201%2F2',
      );
    });

    it('trata como inesperado o documento fora do contrato', async () => {
      const { notes } = setup(apiResponse({ body: { id: 'note-1' } }));

      const result = await notes.get('note-1');

      expect(result).toMatchObject({
        ok: false,
        error: {
          kind: 'unexpected',
          status: 200,
          message: 'O servidor deu uma resposta inesperada.',
        },
      });
    });

    it('repassa o não encontrado', async () => {
      const { notes } = setup(apiResponse({ status: 404, body: {} }));

      const result = await notes.get('note-7');

      expect(result).toMatchObject({
        ok: false,
        error: { kind: 'not-found', status: 404 },
      });
    });
  });

  describe('update', () => {
    it('envia a revisão lida em If-Match e a seguinte no corpo', async () => {
      const saved = { ...stored, revision: 4 };
      const { fetchMock, notes } = setup(apiResponse({ body: saved }));

      await notes.update(stored);

      const sent = sentRequest(fetchMock.mock.calls[0]);
      expect(sent).toMatchObject({
        url: 'http://127.0.0.1:4010/notes/note-1',
        method: 'PUT',
        body: saved,
      });
      expect(sent.headers['if-match']).toBe('"3"');
    });

    it('devolve o documento na revisão nova, mesmo com o ETag ainda na anterior', async () => {
      const saved = { ...stored, revision: 4 };
      const { notes } = setup(apiResponse({ body: saved, revision: 3 }));

      const result = await notes.update(stored);

      expect(result).toEqual({ ok: true, value: saved });
    });

    it('devolve conflito quando o servidor tem outra revisão gravada', async () => {
      const { notes } = setup(
        apiResponse({
          status: 412,
          body: { title: 'Revisão desatualizada', status: 412 },
        }),
      );

      const result = await notes.update(stored);

      expect(result).toMatchObject({
        ok: false,
        error: {
          kind: 'conflict',
          status: 412,
          problem: { title: 'Revisão desatualizada' },
        },
      });
    });
  });

  describe('remove', () => {
    it('apaga o documento pelo id', async () => {
      const { fetchMock, notes } = setup(apiResponse({ status: 204 }));

      const result = await notes.remove('note-1');

      expect(sentRequest(fetchMock.mock.calls[0])).toMatchObject({
        url: 'http://127.0.0.1:4010/notes/note-1',
        method: 'DELETE',
        body: undefined,
      });
      expect(result).toEqual({ ok: true, value: undefined });
    });

    it('aceita a resposta de sucesso com corpo', async () => {
      const { notes } = setup(apiResponse({ status: 200, body: {} }));

      const result = await notes.remove('note-1');

      expect(result).toEqual({ ok: true, value: undefined });
    });

    it('repassa o erro da chamada', async () => {
      const { notes } = setup(apiResponse({ status: 404 }));

      const result = await notes.remove('note-7');

      expect(result).toMatchObject({ ok: false, error: { kind: 'not-found' } });
    });
  });
});

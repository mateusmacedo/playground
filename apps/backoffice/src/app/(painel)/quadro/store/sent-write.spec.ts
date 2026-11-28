import { createBoard } from '../model/board-state';
import { createFakeBoardsApi, storedDocument } from './boards-api-test-kit';
import { type BoardSnapshot, confirmSentWrite } from './sent-write';

const sent: BoardSnapshot = {
  name: 'Vendas',
  board: createBoard({ lanes: [{ id: 'todo', title: 'A fazer', cards: [] }] }),
};

function serverWith(revision: number, snapshot: BoardSnapshot = sent) {
  const api = createFakeBoardsApi();
  api.documents.set(
    'board-1',
    storedDocument({ id: 'board-1', revision, ...snapshot }),
  );
  return api;
}

describe('confirmSentWrite', () => {
  it('diz que o envio não chegou quando o servidor continua na revisão de antes', async () => {
    const api = serverWith(3);

    const result = await confirmSentWrite({
      api,
      boardId: 'board-1',
      revision: 3,
      sent,
    });

    expect(result).toEqual({ ok: true, value: null });
  });

  it('devolve o documento quando o servidor tem a revisão seguinte com o que foi enviado', async () => {
    const api = serverWith(4);

    const result = await confirmSentWrite({
      api,
      boardId: 'board-1',
      revision: 3,
      sent,
    });

    expect(result).toEqual({ ok: true, value: api.documents.get('board-1') });
  });

  it('acusa conflito quando a revisão seguinte traz outro conteúdo ou outro nome', async () => {
    const otherBoard = serverWith(4, {
      name: 'Vendas',
      board: createBoard({ lanes: [] }),
    });
    const otherName = serverWith(4, { ...sent, name: 'Compras' });
    const params = { boardId: 'board-1', revision: 3, sent };

    const results = [
      await confirmSentWrite({ ...params, api: otherBoard }),
      await confirmSentWrite({ ...params, api: otherName }),
    ];

    expect(results.map((result) => !result.ok && result.error.kind)).toEqual([
      'conflict',
      'conflict',
    ]);
  });

  it('acusa conflito quando o servidor andou mais de uma revisão', async () => {
    const api = serverWith(7);

    const result = await confirmSentWrite({
      api,
      boardId: 'board-1',
      revision: 3,
      sent,
    });

    expect(result).toMatchObject({ ok: false, error: { kind: 'conflict' } });
  });

  it('repassa a falha da leitura', async () => {
    const api = serverWith(3);
    api.failNext('server');

    const result = await confirmSentWrite({
      api,
      boardId: 'board-1',
      revision: 3,
      sent,
    });

    expect(result).toMatchObject({ ok: false, error: { kind: 'server' } });
  });

  it('diz que a criação não chegou quando o quadro não existe no servidor', async () => {
    const api = createFakeBoardsApi();

    const result = await confirmSentWrite({
      api,
      boardId: 'board-1',
      revision: null,
      sent,
    });

    expect(result).toEqual({ ok: true, value: null });
  });

  it('devolve o documento criado quando a criação chegou', async () => {
    const api = serverWith(1);

    const result = await confirmSentWrite({
      api,
      boardId: 'board-1',
      revision: null,
      sent,
    });

    expect(result).toEqual({ ok: true, value: api.documents.get('board-1') });
  });

  it('não confunde o quadro que sumiu com a criação que não chegou', async () => {
    const api = createFakeBoardsApi();

    const result = await confirmSentWrite({
      api,
      boardId: 'board-1',
      revision: 3,
      sent,
    });

    expect(result).toMatchObject({ ok: false, error: { kind: 'not-found' } });
  });
});

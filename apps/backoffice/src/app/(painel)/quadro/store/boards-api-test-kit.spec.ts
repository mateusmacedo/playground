import { toBoardDocument } from '../model/board-document';
import { createBoard } from '../model/board-state';
import { createFakeBoardsApi, storedDocument } from './boards-api-test-kit';

const board = createBoard({ lanes: [] });
const content = toBoardDocument({ id: 'board-1', name: 'Vendas', board });

describe('createFakeBoardsApi', () => {
  it('recusa criar um quadro com id que já existe, como o servidor de verdade', async () => {
    const api = createFakeBoardsApi();
    await api.create(content);

    const result = await api.create(content);

    expect(result).toMatchObject({ ok: false, error: { kind: 'invalid' } });
  });

  it('recusa regravar um quadro que não existe', async () => {
    const api = createFakeBoardsApi();

    const result = await api.update({ ...content, revision: 1 });

    expect(result).toMatchObject({ ok: false, error: { kind: 'not-found' } });
  });

  it('guarda o documento sem dividir objeto com quem o enviou', () => {
    const document = storedDocument({
      id: 'board-1',
      name: 'Vendas',
      revision: 2,
      board,
    });

    expect(document).toMatchObject({ ...content, revision: 2, board: {} });
    expect(document.board).not.toBe(board);
  });
});

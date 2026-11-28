import { API_ERROR_MESSAGES } from '@/shared/api/api-result';

import { DEFAULT_BOARDS } from '../model/workspace';
import {
  createFakeBoardsApi,
  type FakeBoardsApi,
  storedDocument,
} from './boards-api-test-kit';
import { advance, titled, WRITE_DELAY } from './http-board-store-test-kit';
import { createHttpWorkspaceStore } from './http-workspace-store';
import type { WorkspaceStore } from './workspace-store';

interface Setup {
  readonly api: FakeBoardsApi;
  readonly store: WorkspaceStore;
}

/** Servidor simulado com os quadros dados, cada um na revisão 1. */
function setup(names: Readonly<Record<string, string>> = {}): Setup {
  const api = createFakeBoardsApi();
  for (const [id, name] of Object.entries(names)) {
    api.documents.set(
      id,
      storedDocument({ id, name, revision: 1, board: titled(name) }),
    );
  }
  const store = createHttpWorkspaceStore({
    api,
    defaultContent: () => titled('Do exemplo'),
    writeDelayMs: WRITE_DELAY,
  });
  return { api, store };
}

describe('createHttpWorkspaceStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lê do servidor a lista, só com o id e o nome de cada quadro', async () => {
    const { store } = setup({ 'board-1': 'Principal', 'board-2': 'Vendas' });

    expect(await store.loadList()).toEqual({
      kind: 'found',
      boards: [
        { id: 'board-1', name: 'Principal' },
        { id: 'board-2', name: 'Vendas' },
      ],
    });
  });

  it('devolve a falha da leitura com o motivo para a tela', async () => {
    const { api, store } = setup({ 'board-1': 'Principal' });
    api.failNext('timeout');

    expect(await store.loadList()).toEqual({
      kind: 'failed',
      message: API_ERROR_MESSAGES.timeout,
    });
  });

  it('cria o quadro padrão quando o servidor não tem nenhum, uma vez só', async () => {
    const { api, store } = setup();

    const first = await store.loadList();
    const second = await store.loadList();
    await advance(WRITE_DELAY);

    expect(first).toEqual({ kind: 'found', boards: DEFAULT_BOARDS });
    expect(second).toEqual(first);
    expect(api.calls.filter((call) => call.startsWith('POST'))).toEqual([
      'POST /boards board-1',
    ]);
    expect(api.documents.get('board-1')).toMatchObject({
      name: 'Quadro principal',
      revision: 1,
      board: { lanes: [{ title: 'Do exemplo' }] },
    });
  });

  it('cria o quadro novo com o conteúdo dado', async () => {
    const { api, store } = setup({ 'board-1': 'Principal' });
    const board = { id: 'board-2', name: 'Vendas' };

    store.create({ boards: [], board, content: titled('Nova') });
    await advance(WRITE_DELAY);

    expect(api.documents.get('board-2')).toMatchObject({
      name: 'Vendas',
      revision: 1,
      board: { lanes: [{ title: 'Nova' }] },
    });
  });

  it('renomeia regravando o documento do quadro', async () => {
    const { api, store } = setup({ 'board-1': 'Principal' });
    await store.board('board-1').load();

    store.rename({ boards: [], boardId: 'board-1', name: 'Operação' });
    await advance(WRITE_DELAY);

    expect(api.documents.get('board-1')).toMatchObject({
      name: 'Operação',
      revision: 2,
    });
  });

  it('exclui o quadro no servidor, sem enviar o que esperava para ser gravado', async () => {
    const { api, store } = setup({
      'board-1': 'Principal',
      'board-2': 'Vendas',
    });
    const boardStore = store.board('board-2');
    await boardStore.load();
    boardStore.save(titled('Editada'));

    const reason = await store.remove({ boards: [], boardId: 'board-2' });
    await advance(WRITE_DELAY);

    expect(reason).toBeNull();
    expect(api.documents.has('board-2')).toBe(false);
    expect(api.calls).not.toContain('PUT /boards/board-2');
    expect(store.board('board-2')).not.toBe(boardStore);
  });

  it('trata como excluído o quadro que o servidor já não tem', async () => {
    const { store } = setup({ 'board-1': 'Principal' });

    expect(await store.remove({ boards: [], boardId: 'board-9' })).toBeNull();
  });

  it('devolve o motivo quando a exclusão falha', async () => {
    const { api, store } = setup({
      'board-1': 'Principal',
      'board-2': 'Vendas',
    });
    api.failNext('server');

    const reason = await store.remove({ boards: [], boardId: 'board-2' });

    expect(reason).toBe(API_ERROR_MESSAGES.server);
    expect(api.documents.has('board-2')).toBe(true);
  });

  it('não relê a lista enquanto uma exclusão está em andamento', async () => {
    const { api, store } = setup({
      'board-1': 'Principal',
      'board-2': 'Vendas',
    });
    const release = api.holdNext();
    const removing = store.remove({ boards: [], boardId: 'board-2' });
    await advance(0);

    expect(await store.remote?.refreshList()).toBeNull();
    release();
    await removing;

    expect(await store.remote?.refreshList()).toEqual([
      { id: 'board-1', name: 'Principal' },
    ]);
  });

  it('devolve sempre o mesmo armazenamento para o mesmo quadro', () => {
    const { store } = setup({ 'board-1': 'Principal' });

    expect(store.board('board-1')).toBe(store.board('board-1'));
    expect(store.board('board-1').remote).toBeDefined();
  });

  it('relê a lista na volta para a aba', async () => {
    const { api, store } = setup({ 'board-1': 'Principal' });
    api.documents.set(
      'board-3',
      storedDocument({
        id: 'board-3',
        name: 'De outra pessoa',
        revision: 1,
        board: titled('Outra'),
      }),
    );

    expect(await store.remote?.refreshList()).toEqual([
      { id: 'board-1', name: 'Principal' },
      { id: 'board-3', name: 'De outra pessoa' },
    ]);
  });

  it('não entrega a releitura que falha, a vazia, nem com quadro por gravar', async () => {
    const { api, store } = setup({ 'board-1': 'Principal' });

    api.failNext('network');
    expect(await store.remote?.refreshList()).toBeNull();

    const boardStore = store.board('board-1');
    await boardStore.load();
    boardStore.save(titled('Editada'));
    api.calls.length = 0;
    expect(await store.remote?.refreshList()).toBeNull();
    expect(api.calls).toEqual([]);

    await advance(WRITE_DELAY);
    api.documents.clear();
    expect(await store.remote?.refreshList()).toBeNull();
  });
});

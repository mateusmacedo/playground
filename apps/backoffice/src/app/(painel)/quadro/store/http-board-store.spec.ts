import { API_ERROR_MESSAGES } from '@/shared/api/api-result';
import { SAVED } from './board-store';
import { createFakeBoardsApi } from './boards-api-test-kit';
import { createHttpBoardStore, UNREADABLE_BOARD } from './http-board-store';
import {
  advance,
  BOARD_ID,
  closedStore,
  FIRST_REVISION,
  openStore,
  serverRevision,
  serverTitle,
  titled,
  WRITE_DELAY,
} from './http-board-store-test-kit';

const PUT = `PUT /boards/${BOARD_ID}`;
const GET = `GET /boards/${BOARD_ID}`;

describe('createHttpBoardStore: leitura', () => {
  it('lê o quadro do servidor, já conferido', async () => {
    const { api, store } = closedStore();

    const result = await store.load();

    expect(result).toMatchObject({
      kind: 'found',
      board: { lanes: [{ title: 'A fazer' }], nextNumber: 1 },
    });
    expect(api.calls).toEqual([GET]);
    expect(store.status()).toBe(SAVED);
    expect(store.hasUnsaved()).toBe(false);
  });

  it('devolve a falha da leitura com o motivo para a tela', async () => {
    const { api, store } = closedStore();
    api.failNext('network');

    const result = await store.load();

    expect(result).toEqual({
      kind: 'failed',
      message: API_ERROR_MESSAGES.network,
    });
  });

  it('recusa o documento que não forma um quadro', async () => {
    const { api, store } = closedStore();
    const document = api.documents.get(BOARD_ID);
    api.documents.set(BOARD_ID, {
      ...document,
      board: { lanes: 'x' },
    } as never);

    const result = await store.load();

    expect(result).toEqual({ kind: 'failed', message: UNREADABLE_BOARD });
  });

  it('quem pede a leitura enquanto ela corre recebe a mesma', async () => {
    const { api, store } = closedStore();

    const [first, second] = await Promise.all([store.load(), store.load()]);
    const third = await store.load();

    expect(second).toBe(first);
    expect(third).not.toBe(first);
    expect(api.calls).toEqual([GET, GET]);
  });
});

describe('createHttpBoardStore: gravação', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não grava o quadro que acabou de ler, nem nada antes de ler', async () => {
    const closed = closedStore();
    closed.store.save(titled('Sem ler'));
    const { api, store, board } = await openStore();

    store.save(board);
    await advance(WRITE_DELAY);

    expect(closed.api.calls).toEqual([]);
    expect(api.calls).toEqual([]);
  });

  it('grava a mudança depois da espera, com a revisão lida', async () => {
    const { api, store } = await openStore();

    store.save(titled('Editada'));
    expect(store.status()).toEqual({ kind: 'pending' });
    expect(store.hasUnsaved()).toBe(true);
    await advance(WRITE_DELAY - 1);
    expect(api.calls).toEqual([]);
    await advance(1);

    expect(api.calls).toEqual([PUT]);
    expect(serverTitle(api)).toBe('Editada');
    expect(serverRevision(api)).toBe(FIRST_REVISION + 1);
    expect(store.status()).toBe(SAVED);
  });

  it('junta as mudanças da espera num envio só, com a mais recente', async () => {
    const { api, store } = await openStore();

    store.save(titled('Primeira'));
    store.save(titled('Segunda'));
    await advance(WRITE_DELAY);

    expect(api.calls).toEqual([PUT]);
    expect(serverTitle(api)).toBe('Segunda');
  });

  it('a gravação seguinte parte da revisão que a anterior deixou', async () => {
    const { api, store } = await openStore();

    store.save(titled('Primeira'));
    await advance(WRITE_DELAY);
    store.save(titled('Segunda'));
    await advance(WRITE_DELAY);

    expect(serverRevision(api)).toBe(FIRST_REVISION + 2);
    expect(serverTitle(api)).toBe('Segunda');
    expect(store.status()).toBe(SAVED);
  });

  it('envia na hora o que esperava quando a tela sai', async () => {
    const { api, store } = await openStore();

    store.save(titled('Na saída'));
    store.remote.flush();
    await advance(0);

    expect(serverTitle(api)).toBe('Na saída');
  });

  it('o envio pedido só termina depois de gravar também a mudança feita durante ele', async () => {
    const { api, store } = await openStore();
    const release = api.holdNext();
    store.save(titled('Primeira'));
    let finished = false;

    const flushed = store.remote.flush().then(() => {
      finished = true;
    });
    await advance(0);
    store.save(titled('Durante o envio'));
    expect(finished).toBe(false);
    release();
    await flushed;

    expect(api.calls).toEqual([PUT, PUT]);
    expect(serverTitle(api)).toBe('Durante o envio');
    expect(store.status()).toBe(SAVED);
  });

  it('o envio pedido sem nada por gravar termina na hora, sem chamar o servidor', async () => {
    const { api, store } = await openStore();

    await store.remote.flush();

    expect(api.calls).toEqual([]);
    expect(store.status()).toBe(SAVED);
  });

  it('o envio pedido termina quando a gravação falha, com a falha na situação', async () => {
    const { api, store } = await openStore();
    api.failNext('server');
    store.save(titled('Não gravada'));

    await store.remote.flush();

    expect(store.status()).toMatchObject({ kind: 'failed', busy: false });
    expect(serverTitle(api)).toBe('A fazer');
  });

  it('avisa quem acompanha a cada mudança de situação', async () => {
    const { store } = await openStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);

    store.save(titled('Editada'));
    await advance(WRITE_DELAY);
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    store.save(titled('Outra'));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('createHttpBoardStore: falha da gravação', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra a falha, e a nova tentativa grava', async () => {
    const { api, store } = await openStore();
    api.failNext('server');

    store.save(titled('Editada'));
    await advance(WRITE_DELAY);
    expect(store.status()).toEqual({
      kind: 'failed',
      message: API_ERROR_MESSAGES.server,
      busy: false,
    });
    expect(serverTitle(api)).toBe('A fazer');

    store.remote.retry();
    expect(store.status()).toMatchObject({ kind: 'failed', busy: true });
    await advance(0);

    expect(serverTitle(api)).toBe('Editada');
    expect(store.status()).toBe(SAVED);
  });

  it('a mudança seguinte tenta de novo sozinha', async () => {
    const { api, store } = await openStore();
    api.failNext('server');
    store.save(titled('Primeira'));
    await advance(WRITE_DELAY);

    store.save(titled('Segunda'));
    await advance(WRITE_DELAY);

    expect(serverTitle(api)).toBe('Segunda');
    expect(store.status()).toBe(SAVED);
  });

  it('a nova tentativa sem nada por gravar não chama o servidor', async () => {
    const { api, store } = await openStore();

    store.remote.retry();
    await advance(WRITE_DELAY);

    expect(api.calls).toEqual([]);
  });

  it('abrir de novo com mudança por gravar mantém a versão da tela', async () => {
    const { api, store } = await openStore();
    const edited = titled('Editada');
    api.failNext('server');
    store.save(edited);
    await advance(WRITE_DELAY);
    api.calls.length = 0;

    const result = await store.load();

    expect(result).toEqual({ kind: 'found', board: edited });
    expect(api.calls).toEqual([]);
    expect(store.status()).toMatchObject({ kind: 'failed' });
  });
});

describe('createHttpBoardStore: quadro novo e nome', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function newStore() {
    const api = createFakeBoardsApi();
    const created = { name: 'Compras', board: titled('Nova') };
    const store = createHttpBoardStore({
      api,
      boardId: 'board-2',
      created,
      writeDelayMs: WRITE_DELAY,
    });
    return { api, store, created };
  }

  it('cria o quadro no servidor na primeira gravação', async () => {
    const { api, store } = newStore();

    expect(store.hasUnsaved()).toBe(true);
    await advance(WRITE_DELAY);

    expect(api.calls).toEqual(['POST /boards board-2']);
    expect(api.documents.get('board-2')).toMatchObject({
      name: 'Compras',
      revision: 1,
      board: { lanes: [{ title: 'Nova' }] },
    });
    expect(store.status()).toBe(SAVED);
  });

  it('abre o quadro novo criando-o antes de ler', async () => {
    const { api, store } = newStore();

    const result = await store.load();

    expect(api.calls).toEqual(['POST /boards board-2', 'GET /boards/board-2']);
    expect(result).toMatchObject({
      kind: 'found',
      board: { lanes: [{ title: 'Nova' }] },
    });
  });

  it('mantém na tela o quadro novo que o servidor recusou', async () => {
    const { api, store, created } = newStore();
    api.failNext('invalid');

    const result = await store.load();

    expect(result).toEqual({ kind: 'found', board: created.board });
    expect(store.status()).toEqual({
      kind: 'failed',
      message: API_ERROR_MESSAGES.invalid,
      busy: false,
    });
  });

  it('não repete a criação que chegou sem resposta', async () => {
    const { api, store } = newStore();
    api.loseNextAnswer();
    await advance(WRITE_DELAY);
    expect(store.status()).toMatchObject({ kind: 'failed' });

    store.remote.retry();
    await advance(0);

    expect(api.calls).toEqual(['POST /boards board-2', 'GET /boards/board-2']);
    expect(store.status()).toBe(SAVED);
  });

  it('renomear regrava o documento com o nome novo', async () => {
    const { api, store } = await openStore();

    store.rename('Vendas');
    store.rename('Comercial');
    await advance(WRITE_DELAY);

    expect(api.calls).toEqual([PUT]);
    expect(api.documents.get(BOARD_ID)).toMatchObject({
      name: 'Comercial',
      revision: FIRST_REVISION + 1,
      board: { lanes: [{ title: 'A fazer' }] },
    });
  });

  it('grava depois da leitura o nome pedido antes de abrir', async () => {
    const { api, store } = closedStore();

    store.rename('Comercial');
    await store.load();
    await advance(WRITE_DELAY);

    expect(api.calls).toEqual([GET, PUT]);
    expect(api.documents.get(BOARD_ID)?.name).toBe('Comercial');
  });

  it('desiste do que esperava quando o quadro vai ser excluído', async () => {
    const { api, store } = await openStore();
    store.save(titled('Editada'));

    await store.discard();
    store.save(titled('Depois'));
    store.rename('Outro nome');
    store.remote.retry();
    await advance(WRITE_DELAY);

    expect(api.calls).toEqual([]);
  });
});

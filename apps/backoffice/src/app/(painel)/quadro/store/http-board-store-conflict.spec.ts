import { API_ERROR_MESSAGES } from '@/shared/api/api-result';

import { SAVED } from './board-store';
import {
  advance,
  BOARD_ID,
  closedStore,
  conflicted,
  FIRST_REVISION,
  openStore,
  otherClientWrites,
  serverRevision,
  serverTitle,
  titled,
  WRITE_DELAY,
} from './http-board-store-test-kit';

const PUT = `PUT /boards/${BOARD_ID}`;
const GET = `GET /boards/${BOARD_ID}`;

describe('createHttpBoardStore: envio sem resposta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não reenvia o que chegou ao servidor, e segue da revisão que ficou lá', async () => {
    const { api, store } = await openStore();
    api.loseNextAnswer();
    store.save(titled('Primeira'));
    await advance(WRITE_DELAY);
    expect(store.status()).toEqual({
      kind: 'failed',
      message: API_ERROR_MESSAGES.network,
      busy: false,
    });

    store.remote.retry();
    await advance(0);
    expect(api.calls).toEqual([PUT, GET]);
    expect(store.status()).toBe(SAVED);

    store.save(titled('Segunda'));
    await advance(WRITE_DELAY);
    expect(serverRevision(api)).toBe(FIRST_REVISION + 2);
    expect(serverTitle(api)).toBe('Segunda');
  });

  it('reenvia o que não chegou ao servidor', async () => {
    const { api, store } = await openStore();
    api.failNext('timeout');
    store.save(titled('Primeira'));
    await advance(WRITE_DELAY);

    store.remote.retry();
    await advance(0);

    expect(api.calls).toEqual([PUT, GET, PUT]);
    expect(serverTitle(api)).toBe('Primeira');
    expect(store.status()).toBe(SAVED);
  });

  it('manda a mudança mais nova por cima da que chegou sem resposta', async () => {
    const { api, store } = await openStore();
    api.loseNextAnswer();
    store.save(titled('Primeira'));
    await advance(WRITE_DELAY);

    store.save(titled('Segunda'));
    await advance(WRITE_DELAY);

    expect(api.calls).toEqual([PUT, GET, PUT]);
    expect(serverRevision(api)).toBe(FIRST_REVISION + 2);
    expect(serverTitle(api)).toBe('Segunda');
    expect(store.status()).toBe(SAVED);
  });

  it('acusa conflito quando outra pessoa gravou no meio', async () => {
    const { api, store } = await openStore();
    api.failNext('network');
    store.save(titled('Primeira'));
    await advance(WRITE_DELAY);
    otherClientWrites(api);

    store.remote.retry();
    await advance(0);

    expect(store.status()).toEqual({ kind: 'conflict', busy: false });
    expect(serverTitle(api)).toBe('De outra pessoa');
  });

  it('mantém a falha enquanto não consegue conferir o servidor', async () => {
    const { api, store } = await openStore();
    api.failNext('network', 'server');
    store.save(titled('Primeira'));
    await advance(WRITE_DELAY);

    store.remote.retry();
    await advance(0);
    expect(store.status()).toEqual({
      kind: 'failed',
      message: API_ERROR_MESSAGES.server,
      busy: false,
    });

    store.remote.retry();
    await advance(0);
    expect(api.calls).toEqual([PUT, GET, GET, PUT]);
    expect(serverTitle(api)).toBe('Primeira');
  });
});

describe('createHttpBoardStore: conflito', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('entra em conflito quando o servidor tem outra revisão, e para de enviar', async () => {
    const { api, store } = await conflicted();
    expect(store.status()).toEqual({ kind: 'conflict', busy: false });

    store.save(titled('Mais uma'));
    store.rename('Outro nome');
    store.remote.retry();
    await advance(WRITE_DELAY);

    expect(api.calls).toEqual([]);
    expect(serverTitle(api)).toBe('De outra pessoa');
  });

  it('abrir de novo em conflito mantém a versão da tela', async () => {
    const { api, store } = await conflicted();
    const mine = titled('Mais uma');
    store.save(mine);

    const result = await store.load();

    expect(result).toEqual({ kind: 'found', board: mine });
    expect(api.calls).toEqual([]);
    expect(store.status()).toMatchObject({ kind: 'conflict' });
  });

  it('manter a minha versão grava a tela por cima do servidor', async () => {
    const { api, store } = await conflicted();
    store.save(titled('Mais uma'));

    store.remote.keepMine();
    await advance(0);

    expect(api.calls).toEqual([GET, PUT]);
    expect(serverTitle(api)).toBe('Mais uma');
    expect(serverRevision(api)).toBe(FIRST_REVISION + 2);
    expect(store.status()).toBe(SAVED);
  });

  it('recarregar do servidor descarta a versão da tela', async () => {
    const { api, store } = await conflicted();

    const theirs = await store.remote.takeTheirs();
    expect(theirs?.lanes[0]?.title).toBe('De outra pessoa');
    expect(store.status()).toBe(SAVED);

    store.save(titled('Depois'));
    await advance(WRITE_DELAY);
    expect(api.calls).toEqual([GET, PUT]);
    expect(serverTitle(api)).toBe('Depois');
    expect(store.status()).toBe(SAVED);
  });

  it('conta por que a saída do conflito não deu certo', async () => {
    const { api, store } = await conflicted();

    api.failNext('network');
    store.remote.keepMine();
    await advance(0);
    expect(store.status()).toEqual({
      kind: 'conflict',
      busy: false,
      failure: API_ERROR_MESSAGES.network,
    });

    api.failNext('server');
    expect(await store.remote.takeTheirs()).toBeNull();
    expect(store.status()).toEqual({
      kind: 'conflict',
      busy: false,
      failure: API_ERROR_MESSAGES.server,
    });

    store.remote.keepMine();
    await advance(0);
    expect(store.status()).toBe(SAVED);
    expect(serverTitle(api)).toBe('Minha');
  });

  it('ocupa as saídas enquanto uma delas corre', async () => {
    const { api, store } = await conflicted();
    const release = api.holdNext();

    store.remote.keepMine();
    expect(store.status()).toEqual({ kind: 'conflict', busy: true });
    store.remote.keepMine();
    expect(await store.remote.takeTheirs()).toBeNull();
    expect(api.calls).toEqual([GET]);

    release();
    await advance(0);
    expect(store.status()).toBe(SAVED);
    expect(serverTitle(api)).toBe('Minha');
  });

  it('volta ao conflito quando o servidor muda de novo no meio da saída', async () => {
    const { api, store } = await conflicted();

    store.remote.keepMine();
    const release = api.holdNext();
    await advance(0);
    otherClientWrites(api);
    release();
    await advance(0);

    expect(api.calls).toEqual([GET, PUT]);
    expect(store.status()).toEqual({ kind: 'conflict', busy: false });
  });

  it('fora do conflito, as saídas dele não fazem nada', async () => {
    const { api, store } = await openStore();

    store.remote.keepMine();
    const theirs = await store.remote.takeTheirs();
    await advance(WRITE_DELAY);

    expect(theirs).toBeNull();
    expect(api.calls).toEqual([]);
  });
});

describe('createHttpBoardStore: volta para a aba', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não entrega nada quando o servidor está na mesma revisão', async () => {
    const { api, store } = await openStore();

    expect(await store.remote.refresh()).toBeNull();
    expect(api.calls).toEqual([GET]);
  });

  it('entrega o quadro que mudou no servidor, e passa a gravar a partir dele', async () => {
    const { api, store } = await openStore();
    otherClientWrites(api);

    const fresh = await store.remote.refresh();
    expect(fresh?.lanes[0]?.title).toBe('De outra pessoa');

    store.save(titled('Depois'));
    await advance(WRITE_DELAY);
    expect(serverRevision(api)).toBe(FIRST_REVISION + 2);
    expect(store.status()).toBe(SAVED);
  });

  it('não relê antes de abrir nem com mudança por gravar', async () => {
    const closed = closedStore();
    const { api, store } = await openStore();
    store.save(titled('Editada'));

    expect(await closed.store.remote.refresh()).toBeNull();
    expect(await store.remote.refresh()).toBeNull();
    expect(closed.api.calls).toEqual([]);
    expect(api.calls).toEqual([]);
  });

  it('ignora a releitura que falha', async () => {
    const { api, store } = await openStore();
    otherClientWrites(api);
    api.failNext('network');

    expect(await store.remote.refresh()).toBeNull();
    expect(store.status()).toBe(SAVED);
  });

  it('a mudança feita durante a releitura vale mais do que ela', async () => {
    const { api, store } = await openStore();
    otherClientWrites(api);
    const release = api.holdNext();

    const refreshing = store.remote.refresh();
    store.save(titled('Minha'));
    release();

    expect(await refreshing).toBeNull();
    await advance(WRITE_DELAY);
    expect(store.status()).toEqual({ kind: 'conflict', busy: false });
  });
});

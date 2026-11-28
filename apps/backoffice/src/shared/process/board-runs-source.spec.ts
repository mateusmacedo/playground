import {
  BOARD_STORAGE_KEY,
  BOARDS_STORAGE_KEY,
  boardStorageKey,
} from '@/shared/board/storage-keys';

import {
  type BoardEntry,
  type BoardRunsReading,
  collectRuns,
  createBrowserBoardRunsSource,
  type LoadedBoardRuns,
} from './board-runs-source';
import { deliveryRun, storeBoards, testBoard } from './board-runs-test-kit';

/** Meia hora depois do início das execuções de teste: dentro do prazo de "Separar". */
const IN_TIME = '2026-11-26T10:30:00.000Z';
/** Duas horas depois do início: o prazo de "Separar" já passou. */
const LATE = '2026-11-26T12:00:00.000Z';

interface CardParams {
  readonly id: string;
  readonly number: number;
  /** Quando a execução do card começou; sem valor, o início padrão das execuções de teste. */
  readonly startedAt?: string;
}

function runningCard(params: CardParams) {
  const { id, number, startedAt } = params;
  const overrides = startedAt === undefined ? {} : { startedAt };
  return { id, number, title: 'Atender', process: deliveryRun(overrides) };
}

function labels(reading: LoadedBoardRuns): readonly string[] {
  return reading.runs.map((run) => `${run.boardName}: ${run.cardLabel}`);
}

function loaded(reading: BoardRunsReading): LoadedBoardRuns {
  if (reading.kind !== 'loaded') {
    throw new Error(`Leitura inesperada: ${reading.kind}.`);
  }
  return reading;
}

describe('collectRuns', () => {
  const sales: BoardEntry = {
    id: 'board-1',
    name: 'Vendas',
    content: {
      kind: 'read',
      board: testBoard({
        cards: [
          runningCard({
            id: 'card-1',
            number: 1,
            startedAt: '2026-11-26T09:00:00.000Z',
          }),
        ],
      }),
    },
  };
  const support: BoardEntry = {
    id: 'board-2',
    name: 'Suporte',
    content: {
      kind: 'read',
      board: testBoard({
        cards: [
          runningCard({
            id: 'card-1',
            number: 4,
            startedAt: '2026-11-20T09:00:00.000Z',
          }),
        ],
      }),
    },
  };

  it('junta as execuções de todos os quadros lidos, das iniciadas há mais tempo para as mais novas', () => {
    const reading = collectRuns({ entries: [sales, support], at: IN_TIME });

    expect(labels(reading)).toEqual([
      'Suporte: QD-4 Atender',
      'Vendas: QD-1 Atender',
    ]);
    expect(reading.unreadBoards).toEqual([]);
  });

  it('usa o instante da leitura para dizer o que está atrasado', () => {
    const reading = collectRuns({ entries: [sales], at: LATE });

    expect(reading.runs[0]?.overdue).toBe(true);
  });

  it('diz o nome dos quadros que não deu para ler e segue com os outros', () => {
    const broken: BoardEntry = {
      id: 'board-3',
      name: 'Financeiro',
      content: { kind: 'unread' },
    };

    const reading = collectRuns({ entries: [broken, sales], at: IN_TIME });

    expect(labels(reading)).toEqual(['Vendas: QD-1 Atender']);
    expect(reading.unreadBoards).toEqual(['Financeiro']);
  });

  it('não conta como falha o quadro que não tem conteúdo', () => {
    const empty: BoardEntry = {
      id: 'board-4',
      name: 'Novo',
      content: { kind: 'absent' },
    };

    expect(collectRuns({ entries: [empty], at: IN_TIME })).toEqual({
      kind: 'loaded',
      runs: [],
      unreadBoards: [],
    });
  });
});

describe('createBrowserBoardRunsSource', () => {
  const board = testBoard({
    cards: [runningCard({ id: 'card-1', number: 1 })],
  });

  async function load(at = IN_TIME): Promise<LoadedBoardRuns> {
    return loaded(await createBrowserBoardRunsSource().load(at));
  }

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('lê as execuções de cada quadro da lista gravada no navegador', async () => {
    storeBoards([
      { id: 'board-1', name: 'Vendas', board },
      { id: 'board-2', name: 'Suporte', board },
    ]);

    const reading = await load();

    expect(labels(reading)).toEqual([
      'Vendas: QD-1 Atender',
      'Suporte: QD-1 Atender',
    ]);
    expect(reading.runs.map((run) => run.ref)).toEqual([
      { boardId: 'board-1', cardId: 'card-1' },
      { boardId: 'board-2', cardId: 'card-1' },
    ]);
  });

  it('lê cada quadro na chave em que o quadro o grava', async () => {
    storeBoards([
      { id: 'board-1', name: 'Vendas', board },
      { id: 'board-2', name: 'Suporte', board },
    ]);

    expect(window.localStorage.getItem(BOARD_STORAGE_KEY)).not.toBeNull();
    expect(
      window.localStorage.getItem(boardStorageKey('board-2')),
    ).not.toBeNull();
    expect((await load()).runs).toHaveLength(2);
  });

  it('diz o que está atrasado no instante da leitura', async () => {
    storeBoards([{ id: 'board-1', name: 'Vendas', board }]);

    expect((await load(LATE)).runs[0]?.overdue).toBe(true);
    expect((await load(IN_TIME)).runs[0]?.overdue).toBe(false);
  });

  it('sem lista gravada, lê o quadro principal na chave de sempre', async () => {
    window.localStorage.setItem(
      BOARD_STORAGE_KEY,
      JSON.stringify({ version: 3, board }),
    );

    expect(labels(await load())).toEqual(['Quadro principal: QD-1 Atender']);
  });

  it.each([
    ['estragada', '{'],
    ['que não é um objeto', '7'],
    ['sem quadros', JSON.stringify({ version: 1, boards: [] })],
    ['sem a lista dentro', JSON.stringify({ version: 1 })],
    [
      'com id repetido',
      JSON.stringify({
        version: 1,
        boards: [
          { id: 'board-2', name: 'Suporte' },
          { id: 'board-2', name: 'Outro' },
        ],
      }),
    ],
  ])('com a lista %s, vale o quadro principal', async (_case, list) => {
    storeBoards([{ id: 'board-1', name: 'Vendas', board }]);
    window.localStorage.setItem(BOARDS_STORAGE_KEY, list);

    expect(labels(await load())).toEqual(['Quadro principal: QD-1 Atender']);
  });

  it('pula o quadro da lista que veio sem id ou sem nome', async () => {
    storeBoards([{ id: 'board-2', name: 'Suporte', board }]);
    window.localStorage.setItem(
      BOARDS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        boards: [
          'quadro',
          { id: 'board-3' },
          { id: '', name: 'Sem id' },
          { id: 'board-2', name: ' Suporte ' },
        ],
      }),
    );

    expect(labels(await load())).toEqual(['Suporte: QD-1 Atender']);
  });

  it('não conta como falha o quadro da lista que ainda não tem conteúdo gravado', async () => {
    storeBoards([
      { id: 'board-2', name: 'Suporte', board: undefined },
      { id: 'board-3', name: 'Financeiro', board: undefined },
    ]);
    window.localStorage.setItem(boardStorageKey('board-3'), '');

    expect(await load()).toEqual({
      kind: 'loaded',
      runs: [],
      unreadBoards: [],
    });
  });

  it('diz o nome do quadro cujo conteúdo gravado está estragado e segue com os outros', async () => {
    storeBoards([
      { id: 'board-1', name: 'Vendas', board },
      { id: 'board-2', name: 'Suporte', board },
      { id: 'board-3', name: 'Financeiro', board },
    ]);
    window.localStorage.setItem(boardStorageKey('board-2'), '{');
    window.localStorage.setItem(boardStorageKey('board-3'), '"texto"');

    const reading = await load();

    expect(labels(reading)).toEqual(['Vendas: QD-1 Atender']);
    expect(reading.unreadBoards).toEqual(['Suporte', 'Financeiro']);
  });

  it('lê como quadro sem execução o conteúdo no formato antigo, só com as colunas', async () => {
    storeBoards([{ id: 'board-1', name: 'Vendas', board: undefined }]);
    window.localStorage.setItem(
      BOARD_STORAGE_KEY,
      JSON.stringify({ version: 1, lanes: [] }),
    );

    expect(await load()).toEqual({
      kind: 'loaded',
      runs: [],
      unreadBoards: [],
    });
  });

  it('com o armazenamento bloqueado pelo navegador, não acha execução nenhuma', async () => {
    storeBoards([{ id: 'board-1', name: 'Vendas', board }]);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(await load()).toEqual({
      kind: 'loaded',
      runs: [],
      unreadBoards: [],
    });
  });
});

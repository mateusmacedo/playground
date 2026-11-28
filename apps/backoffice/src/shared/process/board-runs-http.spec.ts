import { API_ERROR_MESSAGES } from '@/shared/api/api-result';
import type { BoardsApi } from '@/shared/api/boards-api';
import type { BoardDocument } from '@/shared/api/contract';

import { BOARD_READ_LIMIT, createHttpBoardRunsSource } from './board-runs-http';
import type { BoardRunsReading, LoadedBoardRuns } from './board-runs-source';
import {
  boardDocument,
  deliveryRun,
  fakeBoardsListApi,
  testBoard,
} from './board-runs-test-kit';

/** Meia hora depois do início das execuções de teste: dentro do prazo de "Separar". */
const IN_TIME = '2026-11-26T10:30:00.000Z';
/** Duas horas depois do início: o prazo de "Separar" já passou. */
const LATE = '2026-11-26T12:00:00.000Z';

interface DocumentParams {
  readonly id: string;
  readonly name: string;
  /** Quando a execução do card do quadro começou. */
  readonly startedAt?: string;
}

/** Quadro com um card em andamento, o `QD-1 Atender`. */
function documentOf(params: DocumentParams): BoardDocument {
  const { id, name, startedAt } = params;
  const overrides = startedAt === undefined ? {} : { startedAt };
  const card = {
    id: 'card-1',
    number: 1,
    title: 'Atender',
    process: deliveryRun(overrides),
  };
  return boardDocument({ id, name, board: testBoard({ cards: [card] }) });
}

const sales = documentOf({ id: 'board-1', name: 'Vendas' });
const support = documentOf({
  id: 'board-2',
  name: 'Suporte',
  startedAt: '2026-11-20T09:00:00.000Z',
});

function loaded(reading: BoardRunsReading): LoadedBoardRuns {
  if (reading.kind !== 'loaded') {
    throw new Error(`Leitura inesperada: ${reading.kind}.`);
  }
  return reading;
}

function boardNames(reading: LoadedBoardRuns): readonly string[] {
  return reading.runs.map((run) => run.boardName);
}

describe('createHttpBoardRunsSource', () => {
  it('lê a lista de quadros e as execuções de cada um, das iniciadas há mais tempo para as mais novas', async () => {
    const api = fakeBoardsListApi([sales, support]);

    const reading = loaded(await createHttpBoardRunsSource(api).load(IN_TIME));

    expect(api.reads).toEqual(['board-1', 'board-2']);
    expect(boardNames(reading)).toEqual(['Suporte', 'Vendas']);
    expect(reading.runs[1]).toMatchObject({
      ref: { boardId: 'board-1', cardId: 'card-1' },
      cardLabel: 'QD-1 Atender',
      cardHref: '/quadro?quadro=board-1&card=QD-1',
    });
    expect(reading.unreadBoards).toEqual([]);
  });

  it('diz o que está atrasado no instante da leitura', async () => {
    const source = createHttpBoardRunsSource(fakeBoardsListApi([sales]));

    expect(loaded(await source.load(LATE)).runs[0]?.overdue).toBe(true);
    expect(loaded(await source.load(IN_TIME)).runs[0]?.overdue).toBe(false);
  });

  it('usa o nome que o quadro tem agora, e não o da lista', async () => {
    const api = fakeBoardsListApi([sales]);
    const list = api.list;
    const renamedSinceList: BoardsApi = {
      ...api,
      list: async () => {
        const answer = await list();
        api.put({ ...sales, name: 'Vendas diretas' });
        return answer;
      },
    };

    const reading = loaded(
      await createHttpBoardRunsSource(renamedSinceList).load(IN_TIME),
    );

    expect(boardNames(reading)).toEqual(['Vendas diretas']);
  });

  it('falha inteira, com o motivo, quando a lista de quadros não vem', async () => {
    const api = fakeBoardsListApi([sales]);
    api.failNextList('network');

    const reading = await createHttpBoardRunsSource(api).load(IN_TIME);

    expect(reading).toEqual({
      kind: 'failed',
      message: API_ERROR_MESSAGES.network,
    });
    expect(api.reads).toEqual([]);
  });

  it('segue com os outros quando um quadro falha, e diz o nome do que faltou', async () => {
    const api = fakeBoardsListApi([sales, support]);
    api.failNext('server');

    const reading = loaded(await createHttpBoardRunsSource(api).load(IN_TIME));

    expect(boardNames(reading)).toEqual(['Suporte']);
    expect(reading.unreadBoards).toEqual(['Vendas']);
  });

  it('não conta como falha o quadro que saiu do servidor depois da lista', async () => {
    const api = fakeBoardsListApi([sales, support]);
    api.failNext('not-found');

    const reading = loaded(await createHttpBoardRunsSource(api).load(IN_TIME));

    expect(boardNames(reading)).toEqual(['Suporte']);
    expect(reading.unreadBoards).toEqual([]);
  });

  it('falha inteira, com o motivo do primeiro, quando nenhum quadro pôde ser lido', async () => {
    const api = fakeBoardsListApi([sales, support]);
    api.failNext('timeout');
    api.failNext('server');

    const reading = await createHttpBoardRunsSource(api).load(IN_TIME);

    expect(reading).toEqual({
      kind: 'failed',
      message: API_ERROR_MESSAGES.timeout,
    });
  });

  it('não é falha a lista sem quadro nenhum, nem a que só tem quadro que já saiu do servidor', async () => {
    const gone = fakeBoardsListApi([sales]);
    gone.failNext('not-found');
    const empty = { kind: 'loaded', runs: [], unreadBoards: [] };

    expect(
      await createHttpBoardRunsSource(fakeBoardsListApi()).load(IN_TIME),
    ).toEqual(empty);
    expect(await createHttpBoardRunsSource(gone).load(IN_TIME)).toEqual(empty);
  });

  it('lê como quadro sem execução o documento cujo conteúdo não é um quadro', async () => {
    const api = fakeBoardsListApi([
      boardDocument({ id: 'board-1', name: 'Vendas', board: undefined }),
    ]);

    expect(await createHttpBoardRunsSource(api).load(IN_TIME)).toEqual({
      kind: 'loaded',
      runs: [],
      unreadBoards: [],
    });
  });

  it('lê poucos quadros de cada vez e mantém a ordem da lista', async () => {
    const documents: BoardDocument[] = [];
    for (let number = 1; number <= BOARD_READ_LIMIT + 3; number += 1) {
      documents.push(
        documentOf({ id: `board-${number}`, name: `Quadro ${number}` }),
      );
    }
    const base = fakeBoardsListApi(documents);
    let reading = 0;
    let most = 0;
    const slow: BoardsApi = {
      ...base,
      get: async (id) => {
        reading += 1;
        most = Math.max(most, reading);
        // NOTE: a resposta só chega na volta seguinte do navegador, para as leituras se sobreporem.
        await new Promise((answer) => setTimeout(answer, 0));
        reading -= 1;
        return base.get(id);
      },
    };

    const result = loaded(await createHttpBoardRunsSource(slow).load(IN_TIME));

    expect(most).toBe(BOARD_READ_LIMIT);
    expect(boardNames(result)).toEqual(documents.map((item) => item.name));
  });
});

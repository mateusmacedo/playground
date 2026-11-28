import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Activity } from 'react';

import type { BoardsApi } from '@/shared/api/boards-api';
import type { BoardDocument } from '@/shared/api/contract';
import type { PanelApi } from '@/shared/api/panel-api';
import { PanelApiProvider } from '@/shared/api/panel-api-context';
import { BOARD_STORAGE_KEY } from '@/shared/board/storage-keys';
import {
  boardDocument,
  deliveryRun,
  type FakeBoardsListApi,
  fakeBoardsListApi,
  testBoard,
} from '@/shared/process/board-runs-test-kit';
import { fakeDefinitionsApi } from '@/shared/process/definitions-api-fake';

import { RunList } from './run-list';

/** Meia hora depois do início das execuções de teste: "Separar", com prazo de 1 hora, ainda está em dia. */
const NOW = '2026-11-26T10:30:00.000Z';

interface DocumentParams {
  readonly id: string;
  readonly name: string;
  readonly cardNumber: number;
  readonly cardTitle: string;
}

/** Quadro com um card em andamento. */
function documentOf(params: DocumentParams): BoardDocument {
  const { id, name, cardNumber, cardTitle } = params;
  const card = {
    id: `card-${cardNumber}`,
    number: cardNumber,
    title: cardTitle,
    process: deliveryRun({ name: 'Atendimento' }),
  };
  return boardDocument({ id, name, board: testBoard({ cards: [card] }) });
}

const sales = documentOf({
  id: 'board-1',
  name: 'Vendas',
  cardNumber: 1,
  cardTitle: 'Atender o pedido',
});
const support = documentOf({
  id: 'board-2',
  name: 'Suporte',
  cardNumber: 9,
  cardTitle: 'Trocar o cabo',
});

const SALES_CARD = 'QD-1 Atender o pedido';
const SUPPORT_CARD = 'QD-9 Trocar o cabo';
const LOADING = 'Carregando as execuções…';

interface Server extends PanelApi {
  readonly boards: FakeBoardsListApi;
}

function server(documents: readonly BoardDocument[]): Server {
  return {
    boards: fakeBoardsListApi(documents),
    processDefinitions: fakeDefinitionsApi(),
  };
}

function renderList(api: PanelApi): void {
  render(
    <PanelApiProvider value={api}>
      <RunList />
    </PanelApiProvider>,
  );
}

/** O card de cada linha, na ordem da tabela. */
async function cardsInOrder(): Promise<(string | null)[]> {
  const table = await screen.findByRole('table', {
    name: 'Execuções em andamento',
  });
  const rows = within(table).getAllByRole('row').slice(1);
  return rows.map(
    (row) => within(row).getAllByRole('cell')[0]?.textContent ?? null,
  );
}

async function alertText(): Promise<string | null> {
  return (await screen.findByRole('alert')).textContent;
}

function retry(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
}

/** A pessoa sai da aba e volta para ela. */
async function leaveAndComeBack(): Promise<void> {
  await act(async () => {
    fireEvent.blur(window);
    fireEvent.focus(window);
  });
}

/** Deixa as respostas que já estavam a caminho chegarem à tela. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
}

describe('RunList com a API do painel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('mostra o carregamento e, depois, as execuções lidas de todos os quadros', async () => {
    const api = server([sales, support]);

    renderList(api);

    expect(screen.getByText(LOADING)).toBeTruthy();
    expect(await cardsInOrder()).toEqual([SALES_CARD, SUPPORT_CARD]);
    expect(api.boards.reads).toEqual(['board-1', 'board-2']);
    expect(screen.queryByText(LOADING)).toBeNull();
  });

  it('lê da API, e não do que o navegador guarda', async () => {
    window.localStorage.setItem(BOARD_STORAGE_KEY, '{');

    renderList(server([sales]));

    expect(await cardsInOrder()).toEqual([SALES_CARD]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('leva ao card no quadro dele e ao diagrama da execução', async () => {
    renderList(server([support]));
    await cardsInOrder();

    expect(
      screen.getByRole('link', { name: SUPPORT_CARD }).getAttribute('href'),
    ).toBe('/quadro?quadro=board-2&card=QD-9');
    expect(
      screen
        .getByRole('link', { name: `Ver diagrama de ${SUPPORT_CARD}` })
        .getAttribute('href'),
    ).toBe('/processos/execucao?ref=board-2:card-9');
  });

  it('sem execução em andamento no servidor, orienta e leva ao quadro', async () => {
    renderList(server([]));

    expect(
      await screen.findByText('Nenhuma execução em andamento.'),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Ir para o quadro' })
        .getAttribute('href'),
    ).toBe('/quadro');
  });

  it('quando a leitura falha, mostra o motivo e lê de novo ao tentar', async () => {
    const api = server([sales]);
    api.boards.failNextList('network');
    renderList(api);
    expect(await alertText()).toContain(
      'Não foi possível carregar as execuções.',
    );
    expect(await alertText()).toContain(
      'Não foi possível falar com o servidor',
    );
    expect(screen.queryByRole('table')).toBeNull();

    retry();

    expect(screen.getByText(LOADING)).toBeTruthy();
    expect(await cardsInOrder()).toEqual([SALES_CARD]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('quando um quadro falha, mostra os outros e avisa que a lista pode estar incompleta', async () => {
    const api = server([sales, support]);
    api.boards.failNext('server');

    renderList(api);

    expect(await alertText()).toContain(
      'Não foi possível ler o quadro Vendas. A lista pode estar incompleta.',
    );
    expect(await cardsInOrder()).toEqual([SUPPORT_CARD]);
  });

  it('completa a lista ao tentar de novo depois da falha de um quadro', async () => {
    const api = server([sales, support]);
    api.boards.failNext('server');
    renderList(api);
    await alertText();

    retry();

    expect(await cardsInOrder()).toEqual([SALES_CARD, SUPPORT_CARD]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('relê a lista quando a pessoa volta para a aba, sem trocar a tela pelo carregamento', async () => {
    const api = server([sales]);
    renderList(api);
    await cardsInOrder();
    api.boards.put(support);

    await leaveAndComeBack();

    expect(screen.queryByText(LOADING)).toBeNull();
    expect(
      await screen.findByRole('link', { name: SUPPORT_CARD }),
    ).toBeTruthy();
    expect(await cardsInOrder()).toEqual([SALES_CARD, SUPPORT_CARD]);
  });

  it('mantém a lista na tela quando a releitura da volta falha', async () => {
    const api = server([sales]);
    renderList(api);
    await cardsInOrder();
    api.boards.failNextList('network');

    await leaveAndComeBack();
    await settle();

    expect(await cardsInOrder()).toEqual([SALES_CARD]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('não pede outra leitura na volta enquanto a primeira não terminou', async () => {
    const api = server([sales]);
    renderList(api);

    await leaveAndComeBack();
    await cardsInOrder();
    await settle();

    expect(api.boards.reads).toEqual(['board-1']);
  });

  it('descarta a resposta de uma leitura antiga que chega depois da mais nova', async () => {
    const api = server([sales, support]);
    api.boards.failNext('server');
    const waiting: (() => void)[] = [];
    let holding = false;
    const boards: BoardsApi = {
      ...api.boards,
      list: async () => {
        if (holding) {
          await new Promise<void>((open) => {
            waiting.push(open);
          });
        }
        return api.boards.list();
      },
    };
    renderList({ ...api, boards });
    await alertText();
    holding = true;
    await leaveAndComeBack();
    retry();

    await act(async () => waiting[1]?.());
    expect(await cardsInOrder()).toEqual([SALES_CARD, SUPPORT_CARD]);
    api.boards.failNext('server');
    await act(async () => waiting[0]?.());
    await waitFor(() => expect(api.boards.reads).toHaveLength(6));
    await settle();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(await cardsInOrder()).toEqual([SALES_CARD, SUPPORT_CARD]);
  });

  it('relê a lista quando a rota escondida reaparece', async () => {
    const api = server([sales]);
    const route = (visible: boolean) => (
      <Activity mode={visible ? 'visible' : 'hidden'}>
        <PanelApiProvider value={api}>
          <RunList />
        </PanelApiProvider>
      </Activity>
    );
    const { rerender } = render(route(true));
    await cardsInOrder();
    api.boards.put(support);
    rerender(route(false));

    rerender(route(true));

    expect(
      await screen.findByRole('link', { name: SUPPORT_CARD }),
    ).toBeTruthy();
    expect(api.boards.reads).toEqual(['board-1', 'board-1', 'board-2']);
  });
});

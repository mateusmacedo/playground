import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { boardStorageKey } from '@/shared/board/storage-keys';
import {
  deliveryPlan,
  deliveryRun,
  storeBoards,
  storedPlan,
  testBoard,
} from '@/shared/process/board-runs-test-kit';
import {
  begin,
  end,
  planOf,
  resolve,
  STARTED_AT,
  step,
} from '@/shared/process/engine-test-kit';
import { parallelPlan } from '@/shared/process/engine-test-plans';
import type { ProcessRun } from '@/shared/process/run';

import { RunList } from './run-list';

/** Meia hora depois do início das execuções de teste: "Separar", com prazo de 1 hora, ainda está em dia. */
const NOW = '2026-11-26T10:30:00.000Z';

/** Execução atrasada: está em "Separar" há mais de 1 hora. */
function lateRun(overrides: Partial<ProcessRun> = {}): ProcessRun {
  const run = deliveryRun(overrides);
  const tokens = run.tokens.map((token) => ({
    ...token,
    since: '2026-11-26T08:00:00.000Z',
  }));
  return { ...run, tokens };
}

const order = {
  id: 'card-1',
  number: 1,
  title: 'Atender o pedido',
  process: deliveryRun({ name: 'Atendimento' }),
};

const sales = {
  id: 'board-1',
  name: 'Vendas',
  board: testBoard({ cards: [order] }),
};

const support = {
  id: 'board-2',
  name: 'Suporte',
  board: testBoard({
    cards: [
      {
        id: 'card-9',
        number: 9,
        title: 'Trocar o cabo',
        process: deliveryRun({ name: 'Troca' }),
      },
    ],
  }),
};

function table() {
  return screen.findByRole('table', { name: 'Execuções em andamento' });
}

/** As linhas das execuções, sem a do cabeçalho. */
async function runRows(): Promise<HTMLElement[]> {
  const rows = within(await table()).getAllByRole('row');
  return rows.slice(1);
}

/** O card de cada linha, na ordem da tabela. */
async function cardsInOrder(): Promise<(string | null)[]> {
  const rows = await runRows();
  return rows.map(
    (row) => within(row).getAllByRole('cell')[0]?.textContent ?? null,
  );
}

describe('RunList com os quadros gravados no navegador', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('mostra o carregamento enquanto lê e, depois, a tabela', async () => {
    storeBoards([sales]);

    render(<RunList />);

    expect(screen.getByText('Carregando as execuções…')).toBeTruthy();
    expect(await table()).toBeTruthy();
    expect(screen.queryByText('Carregando as execuções…')).toBeNull();
  });

  it('dá à tabela um cabeçalho por coluna', async () => {
    storeBoards([sales]);

    render(<RunList />);

    const headers = within(await table()).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'Processo',
      'Card',
      'Quadro',
      'Etapa atual',
      'Progresso',
      'Início',
      'Diagrama',
    ]);
  });

  it('mostra em cada linha o processo com a versão, o card, o quadro, a etapa, o progresso e o início', async () => {
    storeBoards([sales]);

    render(<RunList />);
    const [row] = await runRows();

    expect(within(row).getByRole('rowheader').textContent).toBe(
      'Atendimento Versão 1',
    );
    const cells = within(row).getAllByRole('cell');
    expect(cells.slice(0, 4).map((cell) => cell.textContent)).toEqual([
      'QD-1 Atender o pedido',
      'Vendas',
      'Separar',
      '0 de 2 etapas',
    ]);
    const started = cells[4]?.querySelector('time');
    expect(started?.getAttribute('dateTime')).toBe(STARTED_AT);
    expect(started?.textContent).toMatch(/^\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}$/);
  });

  it('leva ao card no quadro e ao diagrama da execução dele', async () => {
    storeBoards([sales]);

    render(<RunList />);
    const [row] = await runRows();

    const card = within(row).getByRole('link', {
      name: 'QD-1 Atender o pedido',
    });
    expect(card.getAttribute('href')).toBe('/quadro?quadro=board-1&card=QD-1');
    const diagram = within(row).getByRole('link', {
      name: 'Ver diagrama de QD-1 Atender o pedido',
    });
    expect(diagram.textContent).toBe('Ver diagrama');
    expect(diagram.getAttribute('href')).toBe(
      '/processos/execucao?ref=board-1:card-1',
    );
  });

  it('conta as etapas feitas no progresso', async () => {
    const process = resolve({
      plan: deliveryPlan,
      run: deliveryRun(),
      stepRef: 'pick',
    });
    storeBoards([
      { ...sales, board: testBoard({ cards: [{ ...order, process }] }) },
    ]);

    render(<RunList />);
    const [row] = await runRows();

    expect(within(row).getByText('1 de 2 etapas')).toBeTruthy();
    expect(within(row).getByText('Entregar')).toBeTruthy();
  });

  it('escreve o progresso no singular quando o processo tem uma etapa só', async () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'only' }),
      step({ id: 'only', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const board = testBoard({
      cards: [{ ...order, process: begin(plan) }],
      processes: [storedPlan(plan)],
    });
    storeBoards([{ ...sales, board }]);

    render(<RunList />);
    const [row] = await runRows();

    expect(within(row).getByText('0 de 1 etapa')).toBeTruthy();
  });

  it('escreve o atraso na etapa que passou do prazo, e não nas que estão em dia', async () => {
    const late = { ...order, id: 'card-2', number: 2, process: lateRun() };
    storeBoards([{ ...sales, board: testBoard({ cards: [order, late] }) }]);

    render(<RunList />);
    const [lateRow, inTimeRow] = await runRows();

    expect(within(lateRow).getAllByRole('cell')[2]?.textContent).toBe(
      'Separar Atrasada',
    );
    expect(within(inTimeRow).queryByText('Atrasada')).toBeNull();
  });

  it('mostra como espera a etapa parada numa junção, ao lado da que ainda falta', async () => {
    const process = resolve({
      plan: parallelPlan,
      run: begin(parallelPlan),
      stepRef: 'a',
    });
    const board = testBoard({
      cards: [{ ...order, process }],
      processes: [storedPlan(parallelPlan)],
    });
    storeBoards([{ ...sales, board }]);

    render(<RunList />);
    const [row] = await runRows();

    const steps = within(row).getAllByRole('listitem');
    expect(steps.map((step) => step.textContent).sort()).toEqual([
      'b',
      'join Em espera',
    ]);
  });

  it('diz que não há etapa ativa na execução cujas fichas saíram do roteiro', async () => {
    const run = deliveryRun();
    const lost = run.tokens.map((token) => ({ ...token, stepRef: 'sumiu' }));
    const process = { ...run, tokens: lost };
    storeBoards([
      { ...sales, board: testBoard({ cards: [{ ...order, process }] }) },
    ]);

    render(<RunList />);
    const [row] = await runRows();

    expect(within(row).getByText('Sem etapa ativa')).toBeTruthy();
  });

  it('põe as atrasadas primeiro e, depois, as iniciadas há mais tempo', async () => {
    const cards = [
      {
        ...order,
        id: 'card-1',
        number: 1,
        process: deliveryRun({ startedAt: '2026-11-25T09:00:00.000Z' }),
      },
      {
        ...order,
        id: 'card-2',
        number: 2,
        process: deliveryRun({ startedAt: '2026-11-20T09:00:00.000Z' }),
      },
      {
        ...order,
        id: 'card-3',
        number: 3,
        process: lateRun({ startedAt: '2026-11-26T08:00:00.000Z' }),
      },
    ];
    storeBoards([{ ...sales, board: testBoard({ cards }) }]);

    render(<RunList />);

    expect(await cardsInOrder()).toEqual([
      'QD-3 Atender o pedido',
      'QD-2 Atender o pedido',
      'QD-1 Atender o pedido',
    ]);
  });

  it('junta as execuções de todos os quadros, cada uma com o nome do quadro dela', async () => {
    storeBoards([sales, support]);

    render(<RunList />);
    const rows = await runRows();

    expect(
      rows.map((row) => within(row).getAllByRole('cell')[1]?.textContent),
    ).toEqual(['Vendas', 'Suporte']);
  });

  it('sem execução em andamento, orienta a iniciar um processo num card e leva ao quadro', async () => {
    render(<RunList />);

    expect(
      await screen.findByText('Nenhuma execução em andamento.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Para começar uma, abra um card do quadro e inicie um processo nele.',
      ),
    ).toBeTruthy();
    const board = screen.getByRole('link', { name: 'Ir para o quadro' });
    expect(board.getAttribute('href')).toBe('/quadro');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('avisa que a lista pode estar incompleta quando um quadro não pôde ser lido, e mostra os outros', async () => {
    storeBoards([sales, support]);
    window.localStorage.setItem(boardStorageKey('board-2'), '{');

    render(<RunList />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Não foi possível ler o quadro Suporte. A lista pode estar incompleta.',
    );
    expect(await cardsInOrder()).toEqual(['QD-1 Atender o pedido']);
  });

  it('cita todos os quadros que não pôde ler, mesmo sem execução nenhuma para mostrar', async () => {
    storeBoards([sales, support]);
    window.localStorage.setItem(boardStorageKey('board-1'), '{');
    window.localStorage.setItem(boardStorageKey('board-2'), '{');

    render(<RunList />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Não foi possível ler os quadros Vendas, Suporte. A lista pode estar incompleta.',
    );
    expect(screen.getByText('Nenhuma execução em andamento.')).toBeTruthy();
  });

  it('lê de novo pelo aviso da lista incompleta', async () => {
    storeBoards([sales, support]);
    window.localStorage.setItem(boardStorageKey('board-2'), '{');
    render(<RunList />);
    await screen.findByRole('alert');
    storeBoards([sales, support]);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await cardsInOrder()).toEqual([
      'QD-1 Atender o pedido',
      'QD-9 Trocar o cabo',
    ]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('não relê os quadros quando a pessoa volta para a aba', async () => {
    storeBoards([sales]);
    render(<RunList />);
    await table();
    storeBoards([sales, support]);

    await act(async () => {
      fireEvent.blur(window);
      fireEvent.focus(window);
    });

    expect(await cardsInOrder()).toEqual(['QD-1 Atender o pedido']);
  });
});

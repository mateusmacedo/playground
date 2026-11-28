import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { KanbanBoard } from './kanban-board';
import type { BoardLane } from './model/board';
import { STEPS_NOW, stepsBoard } from './pending-steps-test-data';
import {
  detailsPanel,
  renderStoredBoard,
  showView,
  TEST_BOARD_KEY,
  tableCardTitles,
} from './stored-board-test-kit';
import { boardViewKey } from './use-board-view';

const plainLanes: readonly BoardLane[] = [
  { id: 'todo', title: 'A fazer', cards: [{ id: 'a', title: 'Card A' }] },
];

function table(): HTMLElement {
  return screen.getByRole('table', {
    name: 'Etapas pendentes do quadro, uma por linha',
  });
}

function row(card: string): HTMLElement {
  return within(table()).getByRole('row', { name: new RegExp(card) });
}

function roleFilter(): HTMLSelectElement {
  return screen.getByLabelText('Papel') as HTMLSelectElement;
}

function chooseRole(value: string) {
  fireEvent.change(roleFilter(), { target: { value } });
}

describe('KanbanBoard: visão "Etapas"', () => {
  beforeEach(() => {
    // NOTE: só o relógio é simulado, para a etapa atrasada não depender do dia em que o teste roda.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(STEPS_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('lista as etapas pendentes do quadro, da que vence primeiro para as sem prazo', async () => {
    await renderStoredBoard(stepsBoard());

    showView('Etapas');

    expect(
      screen
        .getByRole('button', { name: 'Etapas' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.queryByRole('region', { name: 'A fazer' })).toBeNull();
    expect(tableCardTitles()).toEqual([
      'Contrato',
      'Proposta',
      'Cadastro',
      'Auditoria',
    ]);
    expect(
      within(table())
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['Analisar', 'Revisar', 'a', 'checkem sub']);
  });

  it('destaca a etapa atrasada e conta as etapas e as atrasadas', async () => {
    await renderStoredBoard(stepsBoard());

    showView('Etapas');

    expect(within(row('Contrato')).getByText('Atrasada')).toBeTruthy();
    expect(within(table()).getAllByText('Atrasada')).toHaveLength(1);
    expect(screen.getByText('4 etapas pendentes, 1 atrasada')).toBeTruthy();
  });

  it('filtra as etapas por papel, inclusive as sem papel', async () => {
    await renderStoredBoard(stepsBoard());
    showView('Etapas');
    expect(Array.from(roleFilter().options, (option) => option.text)).toEqual([
      'Todos os papéis',
      'Analista',
      'Revisor',
      'Sem papel',
    ]);

    chooseRole('role:Revisor');
    expect(tableCardTitles()).toEqual(['Proposta']);
    expect(screen.getByText('1 de 4 etapas pendentes')).toBeTruthy();

    chooseRole('none');
    expect(tableCardTitles()).toEqual(['Cadastro', 'Auditoria']);

    chooseRole('all');
    expect(tableCardTitles()).toHaveLength(4);
  });

  it('abre o card ao acionar o título da linha e devolve o foco a ele ao fechar o painel', async () => {
    await renderStoredBoard(stepsBoard());
    showView('Etapas');
    const title = within(row('Contrato')).getByRole('button', {
      name: 'Contrato',
    });

    fireEvent.click(title);

    expect(
      (within(detailsPanel()).getByLabelText('Título') as HTMLInputElement)
        .value,
    ).toBe('Contrato');
    fireEvent.click(
      within(detailsPanel()).getByRole('button', {
        name: 'Fechar os detalhes',
      }),
    );
    await waitFor(() => expect(document.activeElement).toBe(title));
  });

  it('soma a busca da barra do quadro ao filtro por papel', async () => {
    await renderStoredBoard(stepsBoard());
    showView('Etapas');

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'contrato' },
    });
    expect(tableCardTitles()).toEqual(['Contrato']);
    expect(
      screen.getByText('1 de 4 etapas pendentes, 1 atrasada'),
    ).toBeTruthy();

    chooseRole('role:Revisor');
    expect(screen.queryByRole('table')).toBeNull();
    expect(
      screen.getByText('Nenhuma etapa pendente com os filtros escolhidos.'),
    ).toBeTruthy();
    expect(screen.getByText('0 de 4 etapas pendentes')).toBeTruthy();
  });

  it('volta a mostrar todos os papéis quando o papel escolhido fica sem etapa', async () => {
    await renderStoredBoard(stepsBoard());
    showView('Etapas');
    chooseRole('role:Analista');
    expect(tableCardTitles()).toEqual(['Contrato']);

    fireEvent.click(
      within(row('Contrato')).getByRole('button', { name: 'Contrato' }),
    );
    fireEvent.click(
      within(detailsPanel()).getByRole('button', { name: 'Arquivar card' }),
    );

    expect(roleFilter().value).toBe('all');
    expect(tableCardTitles()).toEqual(['Proposta', 'Cadastro', 'Auditoria']);
    expect(screen.getByText('3 etapas pendentes')).toBeTruthy();
  });

  it('grava a visão como preferência e a retoma ao reabrir o quadro', async () => {
    await renderStoredBoard(stepsBoard());
    showView('Etapas');
    expect(localStorage.getItem(boardViewKey(TEST_BOARD_KEY))).toContain(
      '"mode":"steps"',
    );

    cleanup();
    await renderStoredBoard(stepsBoard());

    expect(table()).toBeTruthy();
  });

  it('explica quando nenhum card tem etapa pendente', () => {
    render(<KanbanBoard initialLanes={plainLanes} />);

    showView('Etapas');

    expect(screen.getByText('Nenhuma etapa pendente no quadro.')).toBeTruthy();
    expect(
      screen.getByText(
        'As etapas dos processos em andamento nos cards aparecem aqui.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByLabelText('Papel')).toBeNull();
  });

  it('conta uma só etapa no singular', async () => {
    const board = stepsBoard();
    const single = {
      ...board,
      lanes: board.lanes.map((lane) => ({
        ...lane,
        cards: lane.cards.filter((card) => card.id === 'proposta'),
      })),
    };
    await renderStoredBoard(single);

    showView('Etapas');

    expect(screen.getByText('1 etapa pendente')).toBeTruthy();
  });
});

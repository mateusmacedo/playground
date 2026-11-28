import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { linearPlan } from '@/shared/process/engine-test-plans';

import { KanbanBoard } from './kanban-board';
import { PLAN_MISSING } from './model/process-run';
import { runningCard } from './model/process-test-data';
import {
  activeStepNames,
  freezeClock,
  openProcessOf,
  processSection,
  releaseClock,
  renderRunning,
} from './process-test-kit';
import { announcement, cardItem, detailsPanel } from './stored-board-test-kit';

function heading(): HTMLElement {
  return within(processSection()).getByRole('heading', { name: 'Processo' });
}

function button(name: string): HTMLElement {
  return within(processSection()).getByRole('button', { name });
}

/** O histórico do card aberto, no painel de detalhes. */
function history(): HTMLElement {
  return within(detailsPanel()).getByRole('region', { name: 'Histórico' });
}

describe('KanbanBoard: cancelar o processo de um card', () => {
  beforeEach(freezeClock);
  afterEach(releaseClock);

  async function openCancelDialog(): Promise<HTMLElement> {
    fireEvent.click(button('Cancelar processo'));
    return screen.findByRole('dialog', {
      name: 'Cancelar o processo Processo',
    });
  }

  it('pede confirmação e, quando a pessoa desiste, mantém o processo e devolve o foco ao botão', async () => {
    await renderRunning(linearPlan);
    const dialog = await openCancelDialog();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Manter o processo' }),
    );

    await waitFor(() =>
      expect(document.activeElement).toBe(button('Cancelar processo')),
    );
    expect(activeStepNames()).toEqual(['a']);
  });

  it('cancela com a confirmação: encerra como cancelado, anuncia e leva o foco ao título', async () => {
    const section = await renderRunning(linearPlan);
    const dialog = await openCancelDialog();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Cancelar processo' }),
    );

    expect(within(section).getByText('Cancelado')).toBeTruthy();
    expect(activeStepNames()).toEqual([]);
    expect(announcement()).toBe('Processo Processo cancelado.');
    expect(
      within(section).getByText('Processo cancelado. Etapas pendentes: a.'),
    ).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(heading()));
    expect(
      within(history()).getByText('Processo Processo cancelado.'),
    ).toBeTruthy();
  });

  it('mostra no card do quadro que o processo foi cancelado e deixa removê-lo ou iniciar outro', async () => {
    await renderRunning(linearPlan);
    const dialog = await openCancelDialog();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Cancelar processo' }),
    );

    expect(
      within(cardItem('Card c1')).getByText('Processo Processo: cancelado'),
    ).toBeTruthy();
    expect(button('Remover processo')).toBeTruthy();
    expect(button('Iniciar outro processo')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(heading()));
  });
});

describe('KanbanBoard: processo sem o roteiro no quadro', () => {
  beforeEach(freezeClock);
  afterEach(releaseClock);

  /** Quadro montado com as colunas, sem os roteiros: a execução do card fica sem ter como andar. */
  async function renderWithoutPlan(): Promise<HTMLElement> {
    render(
      <KanbanBoard
        initialLanes={[
          { id: 'todo', title: 'A fazer', cards: [runningCard({ id: 'c1' })] },
        ]}
      />,
    );
    return openProcessOf('Card c1');
  }

  it('diz que o roteiro não está no quadro, no painel e no selo do card', async () => {
    const section = await renderWithoutPlan();

    expect(within(section).getByRole('alert').textContent).toBe(PLAN_MISSING);
    expect(activeStepNames()).toEqual([]);
    expect(
      within(cardItem('Card c1')).getByText(
        'Processo Processo: sem roteiro no quadro',
      ),
    ).toBeTruthy();
  });

  it('só deixa remover o processo: outro só começa depois de ele sair do card', async () => {
    const section = await renderWithoutPlan();
    expect(
      within(section).queryByRole('button', { name: 'Iniciar outro processo' }),
    ).toBeNull();
    expect(
      within(section).queryByRole('button', { name: 'Cancelar processo' }),
    ).toBeNull();

    fireEvent.click(button('Remover processo'));

    expect(
      within(section).getByText('Este card não segue nenhum processo.'),
    ).toBeTruthy();
    expect(button('Escolher processo')).toBeTruthy();
  });
});

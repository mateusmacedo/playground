import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { STEPS_NOW, stepsBoard } from './pending-steps-test-data';
import {
  announcement,
  detailsPanel,
  renderStoredBoard,
  showView,
} from './stored-board-test-kit';

/** Abre o card pelo botão com o título dele, na tabela da visão aberta, e o arquiva pelo painel. */
function archiveFromTable(title: string): void {
  fireEvent.click(
    within(screen.getByRole('table')).getByRole('button', { name: title }),
  );
  fireEvent.click(
    within(detailsPanel()).getByRole('button', { name: 'Arquivar card' }),
  );
}

describe('KanbanBoard: foco depois de arquivar fora da visão em colunas', () => {
  beforeEach(() => {
    // NOTE: só o relógio é simulado, para a etapa atrasada não depender do dia em que o teste roda.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(STEPS_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('na visão "Etapas", leva o foco ao botão da visão, porque a coluna do card não está na tela', async () => {
    await renderStoredBoard(stepsBoard());
    showView('Etapas');

    archiveFromTable('Contrato');

    expect(announcement()).toBe('Card Contrato arquivado.');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Etapas' }),
      ),
    );
  });

  it('na visão "Lista", leva o foco ao botão da visão', async () => {
    await renderStoredBoard(stepsBoard());
    showView('Lista');

    archiveFromTable('Contrato');

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Lista' }),
      ),
    );
  });
});

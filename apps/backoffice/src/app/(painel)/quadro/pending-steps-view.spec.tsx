import { render, screen } from '@testing-library/react';

import { stepsBoard } from './pending-steps-test-data';
import { PendingStepsView } from './pending-steps-view';

const everyCard = { filtering: false, matches: () => true };

function setup(isClient: boolean) {
  render(
    <PendingStepsView
      board={stepsBoard()}
      filter={everyCard}
      isClient={isClient}
      onOpen={vi.fn()}
    />,
  );
}

describe('PendingStepsView', () => {
  afterEach(() => vi.useRealTimers());

  it('não marca etapa como atrasada antes de a página montar no navegador', () => {
    setup(false);

    expect(screen.getByText('4 etapas pendentes')).toBeTruthy();
    expect(screen.queryByText('Atrasada')).toBeNull();
  });

  it('conta no plural as etapas atrasadas', () => {
    // NOTE: só o relógio é simulado; três dias depois do início, as duas etapas com prazo já venceram.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-29T10:00:00.000Z'));

    setup(true);

    expect(screen.getByText('4 etapas pendentes, 2 atrasadas')).toBeTruthy();
    expect(screen.getAllByText('Atrasada')).toHaveLength(2);
  });
});

import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import type { BoardLane } from './model/board';
import { useBoardScreen } from './use-board-screen';

const lanes: readonly BoardLane[] = [
  { id: 'todo', title: 'A fazer', cards: [{ id: 'a', title: 'Card A' }] },
];

function Probe() {
  const { today } = useBoardScreen({ initialLanes: lanes });
  return <output>{today ?? 'sem relógio'}</output>;
}

describe('useBoardScreen', () => {
  afterEach(() => vi.useRealTimers());

  it('não tem o dia de hoje na renderização do servidor', () => {
    expect(renderToString(<Probe />)).toContain('sem relógio');
  });

  it('tem o dia de hoje depois de montar no navegador', () => {
    // NOTE: só o relógio é simulado, ao meio-dia local, para o dia não depender do fuso de quem roda o teste.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 26, 12));

    render(<Probe />);

    expect(screen.getByRole('status').textContent).toBe('2026-11-26');
  });
});

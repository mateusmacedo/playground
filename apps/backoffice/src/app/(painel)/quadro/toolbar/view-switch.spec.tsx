import { fireEvent, render, screen } from '@testing-library/react';

import type { BoardView } from '../use-board-view';
import { ViewSwitch } from './view-switch';

const boardView: BoardView = {
  mode: 'board',
  grouped: false,
  tree: false,
  collapsedRows: [],
};

function setup(view: BoardView) {
  const onChange = vi.fn();
  render(<ViewSwitch view={view} onChange={onChange} />);
  return onChange;
}

function pressed(name: string): string | null {
  return screen.getByRole('button', { name }).getAttribute('aria-pressed');
}

function toggle(name: string): HTMLInputElement {
  return screen.getByRole('checkbox', { name }) as HTMLInputElement;
}

describe('ViewSwitch', () => {
  it('marca a visão em uso e troca para as outras', () => {
    const onChange = setup(boardView);

    expect(screen.getByRole('group', { name: 'Visão' })).toBeTruthy();
    expect(pressed('Quadro')).toBe('true');
    expect(pressed('Lista')).toBe('false');
    expect(pressed('Etapas')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Etapas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));

    expect(onChange).toHaveBeenNthCalledWith(1, { mode: 'steps' });
    expect(onChange).toHaveBeenNthCalledWith(2, { mode: 'list' });
  });

  it('só liga as linhas por card pai no quadro', () => {
    const onChange = setup(boardView);

    expect(toggle('Linhas por card pai').disabled).toBe(false);
    expect(toggle('Lista em árvore').disabled).toBe(true);

    fireEvent.click(toggle('Linhas por card pai'));
    expect(onChange).toHaveBeenCalledWith({ grouped: true });
  });

  it('só liga a árvore na lista', () => {
    const onChange = setup({ ...boardView, mode: 'list', tree: true });

    expect(pressed('Lista')).toBe('true');
    expect(toggle('Linhas por card pai').disabled).toBe(true);
    expect(toggle('Lista em árvore').disabled).toBe(false);
    expect(toggle('Lista em árvore').checked).toBe(true);

    fireEvent.click(toggle('Lista em árvore'));
    expect(onChange).toHaveBeenCalledWith({ tree: false });
  });

  it('desliga as duas opções na visão de etapas', () => {
    setup({ ...boardView, mode: 'steps' });

    expect(pressed('Etapas')).toBe('true');
    expect(toggle('Linhas por card pai').disabled).toBe(true);
    expect(toggle('Lista em árvore').disabled).toBe(true);
  });
});

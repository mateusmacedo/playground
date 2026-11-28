import { fireEvent, render, screen } from '@testing-library/react';

import { BLOCK_DRAG_TYPE, BlockPalette } from './block-palette';

describe('BlockPalette', () => {
  it('lista os dezoito blocos e insere pelo botão', () => {
    const onAdd = vi.fn();
    render(<BlockPalette onAdd={onAdd} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(18);
    fireEvent.click(
      screen.getByRole('button', { name: 'Inserir Decisão exclusiva' }),
    );

    expect(onAdd).toHaveBeenCalledWith('decision');
  });

  it('oferece a Aprovação entre as atividades', () => {
    const onAdd = vi.fn();
    render(<BlockPalette onAdd={onAdd} />);

    fireEvent.click(screen.getByRole('button', { name: 'Inserir Aprovação' }));

    expect(onAdd).toHaveBeenCalledWith('approval');
  });

  it('leva o tipo do bloco no arraste', () => {
    render(<BlockPalette onAdd={vi.fn()} />);
    const dataTransfer = { setData: vi.fn(), effectAllowed: 'none' };

    fireEvent.dragStart(
      screen
        .getByText('Convergência de alternativas')
        .closest('li') as HTMLElement,
      { dataTransfer },
    );

    expect(dataTransfer.setData).toHaveBeenCalledWith(BLOCK_DRAG_TYPE, 'merge');
    expect(dataTransfer.effectAllowed).toBe('copy');
  });
});

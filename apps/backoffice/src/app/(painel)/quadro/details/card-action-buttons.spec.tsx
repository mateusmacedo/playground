import { fireEvent, render, screen } from '@testing-library/react';

import { CardActionButtons } from './card-action-buttons';

function setup(withTree: boolean) {
  const handlers = {
    onDuplicate: vi.fn(),
    onDuplicateTree: vi.fn(),
    onArchive: vi.fn(),
    onRequestRemove: vi.fn(),
  };
  render(
    <CardActionButtons
      cardId="card-1"
      onDuplicate={handlers.onDuplicate}
      onDuplicateTree={withTree ? handlers.onDuplicateTree : undefined}
      onArchive={handlers.onArchive}
      onRequestRemove={handlers.onRequestRemove}
    />,
  );
  return handlers;
}

describe('CardActionButtons', () => {
  it('oferece duplicar com filhos quando o card tem filhos', () => {
    const handlers = setup(true);

    fireEvent.click(
      screen.getByRole('button', { name: 'Duplicar com filhos' }),
    );

    expect(handlers.onDuplicateTree).toHaveBeenCalledWith('card-1');
    expect(handlers.onDuplicate).not.toHaveBeenCalled();
  });

  it('não mostra duplicar com filhos para o card sem filhos', () => {
    setup(false);

    expect(
      screen.queryByRole('button', { name: 'Duplicar com filhos' }),
    ).toBeNull();
  });

  it('duplica, arquiva e pede a exclusão do card', () => {
    const handlers = setup(false);

    fireEvent.click(screen.getByRole('button', { name: 'Duplicar card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir card' }));

    expect(handlers.onDuplicate).toHaveBeenCalledWith('card-1');
    expect(handlers.onArchive).toHaveBeenCalledWith('card-1');
    expect(handlers.onRequestRemove).toHaveBeenCalledWith('card-1');
  });
});

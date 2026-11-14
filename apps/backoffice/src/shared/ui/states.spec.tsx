import { fireEvent, render, screen } from '@testing-library/react';

import { ErrorState } from './states';

describe('ErrorState', () => {
  it('mostra a mensagem, o detalhe e chama onRetry no botão', () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        detail="Tente em alguns minutos."
        message="Não foi possível carregar as cotações."
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(
      'Não foi possível carregar as cotações.',
    );
    expect(alert.textContent).toContain('Tente em alguns minutos.');

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('com busy trava o botão e não repassa o clique', () => {
    const onRetry = vi.fn();
    render(<ErrorState busy onRetry={onRetry} />);

    const button = screen.getByRole('button', { name: 'Tentar de novo' });
    fireEvent.click(button);

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('sem busy o botão fica liberado', () => {
    render(<ErrorState onRetry={() => undefined} />);

    expect(
      screen
        .getByRole('button', { name: 'Tentar de novo' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });
});

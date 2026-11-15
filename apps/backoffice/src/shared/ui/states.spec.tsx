import { fireEvent, render, screen } from '@testing-library/react';

import { EmptyState, ErrorState, LoadingState } from './states';

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

describe('EmptyState', () => {
  it('mostra a mensagem', () => {
    render(<EmptyState message="Nenhuma cotação ainda." />);

    expect(screen.getByText('Nenhuma cotação ainda.')).toBeTruthy();
  });

  it('mostra a ação passada como filho', () => {
    render(
      <EmptyState message="Nenhuma cotação ainda.">
        <button type="button">Nova cotação</button>
      </EmptyState>,
    );

    expect(screen.getByRole('button', { name: 'Nova cotação' })).toBeTruthy();
  });
});

describe('ErrorState, textos', () => {
  it('mostra o texto padrão da falha quando não recebe mensagem', () => {
    render(<ErrorState onRetry={() => undefined} />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Não foi possível carregar os dados.',
    );
  });

  it('troca o nome do botão por actionLabel', () => {
    render(<ErrorState actionLabel="Recarregar" onRetry={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeTruthy();
  });
});

describe('LoadingState', () => {
  it('anuncia o carregamento com o texto padrão, ocupado', () => {
    render(<LoadingState />);

    const status = screen.getByRole('status');

    expect(status.textContent).toContain('Carregando…');
    expect(status.getAttribute('aria-busy')).toBe('true');
  });

  it('usa o texto dado em label', () => {
    render(<LoadingState label="Buscando cotações…" />);

    expect(screen.getByRole('status').textContent).toContain(
      'Buscando cotações…',
    );
  });

  it('desenha cinco linhas por padrão e a quantidade pedida em rows', () => {
    const { container, rerender } = render(<LoadingState />);
    expect(container.querySelectorAll('.placeholder-glow')).toHaveLength(5);

    rerender(<LoadingState rows={8} />);

    expect(container.querySelectorAll('.placeholder-glow')).toHaveLength(8);
  });
});

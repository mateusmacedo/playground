import { fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@/core/session/session';
import { SessionProvider } from '@/core/session/session-context';

import { SessionGate } from './default-layout';

function renderGate(session: Partial<Session>) {
  const value: Session = {
    status: 'ready',
    user: null,
    permissions: new Set(),
    reload: () => undefined,
    ...session,
  };
  render(
    <SessionProvider value={value}>
      <SessionGate>
        <p>Conteúdo da página</p>
      </SessionGate>
    </SessionProvider>,
  );
}

describe('SessionGate', () => {
  it('mostra a página quando a sessão está pronta', () => {
    renderGate({ status: 'ready' });

    expect(screen.getByText('Conteúdo da página')).toBeTruthy();
  });

  it('mostra o carregamento no lugar da página', () => {
    renderGate({ status: 'loading' });

    expect(screen.getByRole('status').textContent).toContain(
      'Carregando suas permissões…',
    );
    expect(screen.queryByText('Conteúdo da página')).toBeNull();
  });

  it('mostra o erro da sessão com o texto seguro e recarrega ao tentar de novo', () => {
    const reload = vi.fn();
    renderGate({
      status: 'error',
      error: 'O serviço de permissões está fora do ar.',
      reload,
    });

    expect(screen.getByRole('alert').textContent).toContain(
      'O serviço de permissões está fora do ar.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('na sessão expirada com signIn, oferece "Entrar de novo"', () => {
    const signIn = vi.fn();
    const reload = vi.fn();
    renderGate({ status: 'expired', signIn, reload });

    fireEvent.click(screen.getByRole('button', { name: 'Entrar de novo' }));

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('na sessão expirada sem signIn, oferece "Recarregar"', () => {
    const reload = vi.fn();
    renderGate({ status: 'expired', reload });

    expect(screen.queryByRole('button', { name: 'Entrar de novo' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('falha em vez de liberar a página quando o estado não tem tela', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      renderGate({ status: 'suspensa' as Session['status'] }),
    ).toThrow('Estado de sessão sem tela: suspensa');

    vi.restoreAllMocks();
  });
});

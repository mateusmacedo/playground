import { render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { Session } from './session';
import {
  SessionProvider,
  useOptionalSession,
  useSession,
} from './session-context';

function Probe() {
  useSession();
  return <p>dentro</p>;
}

describe('SessionProvider', () => {
  it('sem sessão informada, entrega a provisória: pronta, sem permissões', () => {
    const { result } = renderHook(() => useSession(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SessionProvider>{children}</SessionProvider>
      ),
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.user).toEqual({ displayName: 'Usuário' });
    expect(result.current.permissions.size).toBe(0);
    expect(result.current.signIn).toBeUndefined();
    expect(result.current.signOut).toBeUndefined();
  });

  it('o reload da sessão provisória não faz nada e não falha', () => {
    const { result } = renderHook(() => useSession(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SessionProvider>{children}</SessionProvider>
      ),
    });

    expect(result.current.reload()).toBeUndefined();
  });

  it('entrega a sessão real passada em value', () => {
    const session: Session = {
      status: 'loading',
      user: null,
      permissions: new Set(['quotes:read']),
      reload: () => undefined,
    };

    const { result } = renderHook(() => useSession(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SessionProvider value={session}>{children}</SessionProvider>
      ),
    });

    expect(result.current).toBe(session);
  });
});

describe('useSession', () => {
  it('falha fora do SessionProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow(
      'useSession precisa estar dentro do SessionProvider.',
    );
    expect(screen.queryByText('dentro')).toBeNull();

    vi.restoreAllMocks();
  });

  it('a sessão opcional devolve a sessão dentro do provedor e nada fora dele', () => {
    const inside = renderHook(() => useOptionalSession(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SessionProvider>{children}</SessionProvider>
      ),
    });
    expect(inside.result.current?.user?.displayName).toBe('Usuário');

    const outside = renderHook(() => useOptionalSession());
    expect(outside.result.current).toBeNull();
  });
});

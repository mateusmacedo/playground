'use client';

import { createContext, type ReactNode, useContext } from 'react';

import type { Session } from './session';

const SessionContext = createContext<Session | null>(null);

/**
 * Sessão provisória do template: pronta, com um usuário fixo e sem permissões. A integração de login passa a sessão
 * real em `value`.
 */
const PLACEHOLDER_SESSION: Session = {
  status: 'ready',
  user: { displayName: 'Usuário' },
  permissions: new Set(),
  reload: () => undefined,
};

export function SessionProvider({
  value = PLACEHOLDER_SESSION,
  children,
}: Readonly<{
  value?: Session;
  children: ReactNode;
}>) {
  return <SessionContext value={value}>{children}</SessionContext>;
}

/** A sessão, ou `null` fora do `SessionProvider`, para quem funciona também sem ela. */
export function useOptionalSession(): Session | null {
  return useContext(SessionContext);
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession precisa estar dentro do SessionProvider.');
  }
  return session;
}

'use client';

import type { ReactNode } from 'react';

import { SessionProvider } from '@/core/session/session-context';
import { ToastProvider } from '@/shared/ui/toast';

export interface AppProvidersProps {
  readonly children: ReactNode;
}

/** Provedores do app inteiro, dentro e fora do painel (como numa futura tela de login). */
export function AppProviders({ children }: Readonly<AppProvidersProps>) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}

'use client';

import type { ReactNode } from 'react';
import { CContainer } from '@coreui/react';

import { useSession } from '@/core/session/session-context';
import { ErrorState, LoadingState } from '@/shared/ui/states';

import { AppFooter } from './app-footer';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { ShellProvider } from './shell-context';

/** Enquanto a sessão não fica pronta, o estado dela ocupa o lugar da página. */
function SessionGate({ children }: Readonly<{ children: ReactNode }>) {
  const { status, error, reload, signIn } = useSession();
  switch (status) {
    case 'loading':
      return <LoadingState label="Carregando suas permissões…" />;
    case 'error':
      return (
        <ErrorState
          detail={error}
          message="Não foi possível carregar suas permissões."
          onRetry={reload}
        />
      );
    case 'expired':
      return (
        <ErrorState
          actionLabel="Entrar de novo"
          message="Sua sessão expirou. Entre de novo para continuar."
          onRetry={signIn ?? reload}
        />
      );
    default:
      return children;
  }
}

/** Layout do template do CoreUI: menu lateral, cabeçalho, conteúdo e rodapé. */
export function DefaultLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ShellProvider>
      <a
        className="skip-link btn btn-primary position-fixed top-0 start-0 m-2"
        href="#conteudo"
        style={{ zIndex: 2000 }}
      >
        Pular para o conteúdo
      </a>
      <AppSidebar />
      <div className="wrapper d-flex flex-column min-vh-100">
        <AppHeader />
        <main className="body flex-grow-1" id="conteudo">
          <CContainer className="h-auto px-4" lg>
            <SessionGate>{children}</SessionGate>
          </CContainer>
        </main>
        <AppFooter />
      </div>
    </ShellProvider>
  );
}

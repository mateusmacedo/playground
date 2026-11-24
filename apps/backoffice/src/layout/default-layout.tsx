'use client';

import { CContainer } from '@coreui/react';
import type { ReactNode } from 'react';

import { useSession } from '@/core/session/session-context';
import { ErrorState, LoadingState } from '@/shared/ui/states';

import { AppFooter } from './app-footer';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { ShellProvider } from './shell-context';

/** Enquanto a sessão não fica pronta, o estado dela ocupa o lugar da página. */
export function SessionGate({ children }: Readonly<{ children: ReactNode }>) {
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
          actionLabel={signIn ? 'Entrar de novo' : 'Recarregar'}
          message="Sua sessão expirou. Entre de novo para continuar."
          onRetry={signIn ?? reload}
        />
      );
    case 'ready':
      return children;
    default: {
      // WHY: um estado novo no contrato da sessão precisa de uma tela aqui; falhar alto evita liberar a página sem
      // querer, e o `never` faz o compilador apontar o caso que faltou.
      const unhandled: never = status;
      throw new Error(`Estado de sessão sem tela: ${String(unhandled)}`);
    }
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
          <CContainer className="h-auto px-4" fluid>
            <SessionGate>{children}</SessionGate>
          </CContainer>
        </main>
        <AppFooter />
      </div>
    </ShellProvider>
  );
}

import { cilContrast, cilMoon } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { Session } from '@/core/session/session';
import { SessionProvider } from '@/core/session/session-context';

import { AppHeader } from './app-header';
import { THEME_STORAGE_KEY } from './color-mode';
import { ShellProvider, useShell } from './shell-context';

const navigation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

function SidebarState() {
  const { sidebarVisible } = useShell();
  return <p>menu {sidebarVisible ? 'visível' : 'escondido'}</p>;
}

function Providers({
  session,
  children,
}: Readonly<{ session?: Session; children: ReactNode }>) {
  return (
    <SessionProvider value={session}>
      <ShellProvider>{children}</ShellProvider>
    </SessionProvider>
  );
}

function renderHeader(session?: Session) {
  return render(
    <Providers session={session}>
      <AppHeader />
      <SidebarState />
    </Providers>,
  );
}

function sessionOf(overrides: Partial<Session>): Session {
  return {
    status: 'ready',
    user: { displayName: 'Maria Souza' },
    permissions: new Set(),
    reload: () => undefined,
    ...overrides,
  };
}

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function iconContent(icon: string[]): string | undefined {
  return parseHtml(
    renderToStaticMarkup(<CIcon icon={icon} size="lg" />),
  ).querySelector('svg')?.innerHTML;
}

function stubSystemScheme(dark: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: dark,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('AppHeader', () => {
  beforeEach(() => {
    navigation.pathname = '/';
    localStorage.clear();
    document.documentElement.removeAttribute('data-coreui-theme');
    stubSystemScheme(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('menu lateral', () => {
    it('esconde e volta a mostrar o menu pelo botão do cabeçalho', () => {
      renderHeader();
      const toggler = screen.getByRole('button', {
        name: 'Mostrar ou esconder o menu lateral',
      });

      fireEvent.click(toggler);
      expect(screen.getByText('menu escondido')).toBeTruthy();

      fireEvent.click(toggler);
      expect(screen.getByText('menu visível')).toBeTruthy();
    });
  });

  describe('tema', () => {
    it('troca para o tema escolhido, aplica na página e guarda a escolha', () => {
      renderHeader();

      fireEvent.click(screen.getByRole('button', { name: 'Escolher o tema' }));
      fireEvent.click(screen.getByRole('button', { name: 'Escuro' }));

      expect(document.documentElement.dataset.coreuiTheme).toBe('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('oferece os três modos e marca o que está em uso', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      renderHeader();

      fireEvent.click(screen.getByRole('button', { name: 'Escolher o tema' }));

      expect(screen.getByRole('button', { name: 'Claro' }).classList).toContain(
        'active',
      );
      expect(
        screen.getByRole('button', { name: 'Escuro' }).classList,
      ).not.toContain('active');
      expect(
        screen.getByRole('button', { name: 'Automático' }).classList,
      ).not.toContain('active');
    });

    it('antes da hidratação mostra o ícone neutro e nenhum modo marcado', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');

      const html = renderToStaticMarkup(
        <Providers>
          <AppHeader />
        </Providers>,
      );

      const page = parseHtml(html);
      const icon = page.querySelector(
        '[aria-label="Escolher o tema"] svg',
      )?.innerHTML;
      expect(icon).toBe(iconContent(cilContrast));
      expect(icon).not.toBe(iconContent(cilMoon));
      expect(page.querySelector('.dropdown-item.active')).toBeNull();
    });
  });

  describe('usuário', () => {
    it('mostra o nome e a organização no menu do usuário', () => {
      renderHeader(
        sessionOf({
          user: { displayName: 'Maria Souza', organization: 'Acme Ltda.' },
        }),
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'Abrir o menu do usuário' }),
      );

      expect(screen.getByText('Maria Souza')).toBeTruthy();
      expect(screen.getByText('Acme Ltda.')).toBeTruthy();
    });

    it('sem organização mostra só o nome', () => {
      renderHeader(sessionOf({ user: { displayName: 'Maria Souza' } }));

      expect(screen.queryByText('Acme Ltda.')).toBeNull();
      expect(screen.getByText('Maria Souza')).toBeTruthy();
    });

    it('sem usuário na sessão mostra "Conta"', () => {
      renderHeader(sessionOf({ user: null }));

      expect(screen.getByText('Conta')).toBeTruthy();
    });

    it('com signOut oferece "Sair" e chama a saída ao clicar', () => {
      const signOut = vi.fn();
      renderHeader(sessionOf({ signOut }));

      fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

      expect(signOut).toHaveBeenCalledTimes(1);
    });

    it('sem signOut não mostra "Sair"', () => {
      renderHeader(sessionOf({}));

      expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull();
    });
  });

  describe('sombra ao rolar a página', () => {
    afterEach(() => {
      document.documentElement.scrollTop = 0;
    });

    it('ganha sombra quando a página rola e perde ao voltar ao topo', () => {
      renderHeader();
      const header = screen
        .getByRole('button', { name: 'Mostrar ou esconder o menu lateral' })
        .closest('.header');
      expect(header?.classList).not.toContain('shadow-sm');

      vi.spyOn(document.documentElement, 'scrollTop', 'get').mockReturnValue(
        120,
      );
      act(() => {
        document.dispatchEvent(new Event('scroll'));
      });
      expect(header?.classList).toContain('shadow-sm');

      vi.spyOn(document.documentElement, 'scrollTop', 'get').mockReturnValue(0);
      act(() => {
        document.dispatchEvent(new Event('scroll'));
      });
      expect(header?.classList).not.toContain('shadow-sm');
    });

    it('para de acompanhar a rolagem quando o cabeçalho sai da tela', () => {
      const removeListener = vi.spyOn(document, 'removeEventListener');
      const { unmount } = renderHeader();

      unmount();

      expect(removeListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
      );
    });
  });

  it('mostra o breadcrumb da rota', () => {
    navigation.pathname = '/sem-acesso';

    renderHeader();

    expect(screen.getByText('Sem acesso')).toBeTruthy();
  });
});

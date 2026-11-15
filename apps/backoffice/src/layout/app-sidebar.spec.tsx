import { fireEvent, render, screen } from '@testing-library/react';

import { appConfig } from '@/core/config/app-config';
import { SessionProvider } from '@/core/session/session-context';

import { AppSidebar } from './app-sidebar';
import { ShellProvider, useShell } from './shell-context';

const navigation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

function ShellState() {
  const { sidebarVisible, sidebarUnfoldable } = useShell();
  return (
    <p data-testid="shell">
      {sidebarVisible ? 'visível' : 'escondido'} ·{' '}
      {sidebarUnfoldable ? 'estreito' : 'cheio'}
    </p>
  );
}

function renderSidebar() {
  navigation.pathname = '/';
  render(
    <SessionProvider>
      <ShellProvider>
        <AppSidebar />
        <ShellState />
      </ShellProvider>
    </SessionProvider>,
  );
}

describe('AppSidebar', () => {
  it('é a navegação "Menu lateral" do painel', () => {
    renderSidebar();

    expect(
      screen.getByRole('navigation', { name: 'Menu lateral' }),
    ).toBeTruthy();
  });

  it('leva ao início pela marca do painel', () => {
    renderSidebar();

    const brand = screen.getByRole('link', { name: appConfig.appName });

    expect(brand.getAttribute('href')).toBe('/');
  });

  it('mostra os itens que a sessão libera', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: 'Início' })).toBeTruthy();
  });

  it('esconde o menu pelo botão de fechar', () => {
    renderSidebar();

    fireEvent.click(
      screen.getByRole('button', { name: 'Fechar o menu lateral' }),
    );

    expect(screen.getByTestId('shell').textContent).toContain('escondido');
  });

  it('estreita e volta a expandir o menu pelo botão do rodapé', () => {
    renderSidebar();
    const toggle = screen.getByRole('button', {
      name: 'Recolher ou expandir o menu lateral',
    });

    fireEvent.click(toggle);
    expect(screen.getByTestId('shell').textContent).toContain('estreito');

    fireEvent.click(toggle);
    expect(screen.getByTestId('shell').textContent).toContain('cheio');
  });
});

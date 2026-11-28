import { fireEvent, render, screen, within } from '@testing-library/react';

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

function renderSidebar(pathname = '/') {
  navigation.pathname = pathname;
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

  it('mostra o grupo Processos, fechado, com o editor e as execuções como filhos', () => {
    renderSidebar();
    const menu = within(
      screen.getByRole('navigation', { name: 'Menu lateral' }),
    );

    const group = menu.getByRole('link', { name: /Processos/ });
    expect(group.getAttribute('aria-expanded')).toBe('false');
    expect(group.textContent).toContain('Beta');
    expect(
      menu.getByRole('link', { name: 'Editor' }).getAttribute('href'),
    ).toBe('/processos');
    expect(
      menu.getByRole('link', { name: 'Execuções' }).getAttribute('href'),
    ).toBe('/processos/execucao');
  });

  it('na rota do editor, abre o grupo Processos e marca só o editor', () => {
    renderSidebar('/processos');
    const menu = within(
      screen.getByRole('navigation', { name: 'Menu lateral' }),
    );

    expect(
      menu
        .getByRole('link', { name: /Processos/ })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(
      menu.getByRole('link', { name: 'Editor' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      menu
        .getByRole('link', { name: 'Execuções' })
        .getAttribute('aria-current'),
    ).toBeNull();
  });

  it('na rota das execuções, abre o grupo Processos e marca só as execuções', () => {
    renderSidebar('/processos/execucao');
    const menu = within(
      screen.getByRole('navigation', { name: 'Menu lateral' }),
    );

    expect(
      menu
        .getByRole('link', { name: /Processos/ })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(
      menu
        .getByRole('link', { name: 'Execuções' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      menu.getByRole('link', { name: 'Editor' }).getAttribute('aria-current'),
    ).toBeNull();
    expect(
      menu.getByRole('link', { name: /Quadro/ }).getAttribute('aria-current'),
    ).toBeNull();
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

  it('com o menu estreito, mantém o grupo Processos com os filhos e ainda o abre pelo botão dele', () => {
    renderSidebar();
    const menu = within(
      screen.getByRole('navigation', { name: 'Menu lateral' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Recolher ou expandir o menu lateral',
      }),
    );

    fireEvent.click(menu.getByRole('link', { name: /Processos/ }));

    expect(screen.getByTestId('shell').textContent).toContain('estreito');
    expect(
      menu
        .getByRole('link', { name: /Processos/ })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(
      menu.getByRole('link', { name: 'Editor' }).getAttribute('href'),
    ).toBe('/processos');
    expect(
      menu.getByRole('link', { name: 'Execuções' }).getAttribute('href'),
    ).toBe('/processos/execucao');
  });

  describe('menu estreito e teclado', () => {
    const NARROW = 'sidebar-narrow-unfoldable';

    function narrowSidebar(): HTMLElement {
      renderSidebar();
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Recolher ou expandir o menu lateral',
        }),
      );
      return screen.getByRole('navigation', { name: 'Menu lateral' });
    }

    /**
     * Responde só à pergunta "o foco veio do teclado?" e deixa as outras consultas como são, porque a própria
     * biblioteca de teste usa `matches` para achar os elementos.
     */
    function answerFocusVisible(answer: boolean | 'unknown'): void {
      const original = Element.prototype.matches;
      vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
        this: Element,
        selector: string,
      ) {
        if (selector !== ':focus-visible') {
          return original.call(this, selector);
        }
        if (answer === 'unknown') {
          throw new DOMException('seletor inválido', 'SyntaxError');
        }
        return answer;
      });
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('abre o menu inteiro enquanto o foco do teclado está nele e volta a estreitar quando o foco sai', () => {
      answerFocusVisible(true);
      const sidebar = narrowSidebar();
      const group = within(sidebar).getByRole('link', { name: /Processos/ });
      expect(sidebar.className).toContain(NARROW);

      fireEvent.focus(group);
      expect(sidebar.className).not.toContain(NARROW);
      expect(screen.getByTestId('shell').textContent).toContain('estreito');

      fireEvent.blur(group, { relatedTarget: document.body });
      expect(sidebar.className).toContain(NARROW);
    });

    it('continua inteiro quando o foco passa de um item do menu para outro', () => {
      answerFocusVisible(true);
      const sidebar = narrowSidebar();
      const group = within(sidebar).getByRole('link', { name: /Processos/ });
      const editor = within(sidebar).getByRole('link', { name: 'Editor' });

      fireEvent.focus(group);
      fireEvent.blur(group, { relatedTarget: editor });

      expect(sidebar.className).not.toContain(NARROW);
    });

    it('não abre quando o foco chega por clique, que já tem o ponteiro sobre o menu', () => {
      answerFocusVisible(false);
      const sidebar = narrowSidebar();

      fireEvent.focus(within(sidebar).getByRole('link', { name: 'Início' }));

      expect(sidebar.className).toContain(NARROW);
    });

    it('trata como teclado o navegador que não conhece o seletor de foco visível', () => {
      answerFocusVisible('unknown');
      const sidebar = narrowSidebar();

      fireEvent.focus(within(sidebar).getByRole('link', { name: 'Início' }));

      expect(sidebar.className).not.toContain(NARROW);
    });
  });
});

import { cilBell, cilHome } from '@coreui/icons';
import { render, screen } from '@testing-library/react';

import { AppSidebarNav } from './app-sidebar-nav';
import type { NavItem } from './nav';

const navigation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

const items: NavItem[] = [
  { kind: 'title', name: 'Comercial' },
  { kind: 'link', name: 'Início', href: '/', icon: cilHome },
  {
    kind: 'link',
    name: 'Cotações',
    href: '/cotacoes',
    badge: { text: 'Novo', color: 'info' },
  },
  {
    kind: 'group',
    name: 'Ocorrências',
    icon: cilBell,
    items: [
      { kind: 'link', name: 'Abertas', href: '/ocorrencias' },
      { kind: 'link', name: 'Relatórios', href: '/ocorrencias/relatorios' },
    ],
  },
];

function renderNav(pathname: string, navItems: readonly NavItem[] = items) {
  navigation.pathname = pathname;
  return render(<AppSidebarNav items={navItems} />);
}

describe('AppSidebarNav', () => {
  it('mostra o título da seção, os links com o destino e o selo', () => {
    renderNav('/');

    expect(screen.getByText('Comercial')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Início/ }).getAttribute('href'),
    ).toBe('/');
    const quotes = screen.getByRole('link', { name: /Cotações/ });
    expect(quotes.getAttribute('href')).toBe('/cotacoes');
    expect(quotes.textContent).toContain('Novo');
  });

  it('marca só o item da rota atual', () => {
    renderNav('/cotacoes');

    expect(screen.getByRole('link', { name: /Cotações/ }).classList).toContain(
      'active',
    );
    expect(
      screen.getByRole('link', { name: /Início/ }).classList,
    ).not.toContain('active');
  });

  it('mostra o item sem selo quando ele não tem um', () => {
    renderNav('/');

    expect(screen.getByRole('link', { name: /Início/ }).textContent).toBe(
      'Início',
    );
  });

  it('lista os filhos do grupo, cada um com o marcador no lugar do ícone', () => {
    const { container } = renderNav('/');

    const abertas = screen.getByRole('link', { name: 'Abertas' });
    expect(abertas.getAttribute('href')).toBe('/ocorrencias');
    expect(screen.getByRole('link', { name: 'Relatórios' })).toBeTruthy();
    expect(container.querySelectorAll('.nav-icon-bullet')).toHaveLength(2);
  });

  it('mantém o grupo fechado quando nenhum filho é a rota atual', () => {
    const { container } = renderNav('/');

    expect(container.querySelector('.nav-group')?.classList).not.toContain(
      'show',
    );
  });

  it('abre o grupo quando um filho é a rota atual', () => {
    const { container } = renderNav('/ocorrencias/relatorios');

    expect(container.querySelector('.nav-group')?.classList).toContain('show');
    expect(
      screen.getByRole('link', { name: 'Relatórios' }).classList,
    ).toContain('active');
  });

  it('mostra o ícone do grupo no botão que abre o submenu', () => {
    const { container } = renderNav('/');

    expect(
      container.querySelector('.nav-group-toggle .nav-icon')?.tagName,
    ).toBe('svg');
  });

  it('não mostra nada quando não há itens', () => {
    const { container } = renderNav('/', []);

    expect(container.querySelectorAll('li')).toHaveLength(0);
  });
});

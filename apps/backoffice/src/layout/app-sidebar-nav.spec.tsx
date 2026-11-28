import { cilBell, cilHome } from '@coreui/icons';
import { fireEvent, render, screen } from '@testing-library/react';

import { AppSidebarNav } from './app-sidebar-nav';
import { buildNav, type NavItem } from './nav';

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

  it('diz ao leitor de tela qual é o item da rota atual, e só ele', () => {
    renderNav('/cotacoes');

    expect(
      screen
        .getByRole('link', { name: /Cotações/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.getByRole('link', { name: /Início/ }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('na rota de um filho, marca só ele e não o irmão de endereço mais curto', () => {
    renderNav('/ocorrencias/relatorios');

    expect(
      screen
        .getByRole('link', { name: 'Relatórios' })
        .getAttribute('aria-current'),
    ).toBe('page');
    const open = screen.getByRole('link', { name: 'Abertas' });
    expect(open.getAttribute('aria-current')).toBeNull();
    expect(open.classList).not.toContain('active');
  });

  it('na rota abaixo do filho, mantém o filho marcado e o grupo aberto', () => {
    renderNav('/ocorrencias/42');

    expect(
      screen
        .getByRole('link', { name: 'Abertas' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(groupToggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('diz no botão do grupo que ele está fechado quando nenhum filho é a rota atual', () => {
    renderNav('/');

    expect(groupToggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('diz no botão do grupo que ele está aberto quando um filho é a rota atual', () => {
    renderNav('/ocorrencias');

    expect(groupToggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('abre e fecha o grupo pelo botão dele', () => {
    renderNav('/');

    fireEvent.click(groupToggle());
    expect(groupToggle().getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(groupToggle());
    expect(groupToggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('fecha o grupo quando a rota deixa de ser a de um filho', () => {
    const { rerender } = renderNav('/ocorrencias');
    navigation.pathname = '/cotacoes';

    rerender(<AppSidebarNav items={items} />);

    expect(groupToggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('mostra o selo do grupo no botão que o abre', () => {
    renderNav('/', [
      {
        kind: 'group',
        name: 'Processos',
        badge: { text: 'Beta', color: 'info' },
        items: [{ kind: 'link', name: 'Editor', href: '/processos' }],
      },
    ]);

    const toggle = screen.getByRole('link', { name: /Processos/ });
    expect(toggle.textContent).toContain('Beta');
    expect(screen.getByRole('link', { name: 'Editor' }).textContent).toBe(
      'Editor',
    );
  });

  it('com o menu filtrado pela sessão, não mostra o grupo sem filho liberado e mantém os outros', () => {
    const restricted: NavItem[] = [
      {
        kind: 'group',
        name: 'Usuários',
        items: [
          {
            kind: 'link',
            name: 'Lista',
            href: '/usuarios',
            permission: 'users:read',
          },
        ],
      },
      ...items,
    ];

    renderNav('/', buildNav(restricted, new Set()));

    expect(screen.queryByRole('link', { name: 'Usuários' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Lista' })).toBeNull();
    expect(groupToggle()).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abertas' })).toBeTruthy();
  });
});

/** O botão que abre e fecha o grupo "Ocorrências". */
function groupToggle() {
  return screen.getByRole('link', { name: 'Ocorrências' });
}

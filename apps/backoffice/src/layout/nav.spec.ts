import { buildNav, isActivePath, type NavItem, navItems } from './nav';

const items: NavItem[] = [
  { kind: 'title', name: 'Comercial' },
  {
    kind: 'link',
    name: 'Cotações',
    href: '/cotacoes',
    permission: 'quotes:read',
  },
  { kind: 'title', name: 'Operação' },
  {
    kind: 'group',
    name: 'Ocorrências',
    items: [
      {
        kind: 'link',
        name: 'Abertas',
        href: '/ocorrencias',
        permission: 'operations:read',
      },
      { kind: 'link', name: 'Relatórios', href: '/ocorrencias/relatorios' },
    ],
  },
  { kind: 'title', name: 'Sem itens' },
];

const names = (nav: NavItem[]) =>
  nav.map((item) =>
    item.kind === 'group'
      ? `${item.name}[${item.items.map((link) => link.name).join(',')}]`
      : item.name,
  );

describe('navItems', () => {
  it('marca o Quadro como beta', () => {
    const board = navItems.find(
      (item) => item.kind === 'link' && item.href === '/quadro',
    );
    expect(board).toMatchObject({ badge: { text: 'Beta', color: 'info' } });
  });
});

describe('buildNav', () => {
  it('mantém os itens liberados e os que não exigem permissão', () => {
    const nav = buildNav(items, new Set(['quotes:read', 'operations:read']));

    expect(names(nav)).toEqual([
      'Comercial',
      'Cotações',
      'Operação',
      'Ocorrências[Abertas,Relatórios]',
    ]);
  });

  it('tira o item sem permissão e o título que ficou sem itens', () => {
    const nav = buildNav(items, new Set(['operations:read']));

    expect(names(nav)).toEqual(['Operação', 'Ocorrências[Abertas,Relatórios]']);
  });

  it('tira do grupo os filhos sem permissão', () => {
    const nav = buildNav(items, new Set());

    expect(names(nav)).toEqual(['Operação', 'Ocorrências[Relatórios]']);
  });

  it('some com o grupo que ficou sem filhos', () => {
    const onlyRestricted: NavItem[] = [
      { kind: 'title', name: 'Admin' },
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
    ];

    expect(buildNav(onlyRestricted, new Set())).toEqual([]);
  });
});

describe('isActivePath', () => {
  it('ativa a raiz só na raiz', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/cotacoes', '/')).toBe(false);
  });

  it('ativa o item na própria rota e nas rotas abaixo dela', () => {
    expect(isActivePath('/cotacoes', '/cotacoes')).toBe(true);
    expect(isActivePath('/cotacoes/42', '/cotacoes')).toBe(true);
  });

  it('não confunde rotas que só começam com o mesmo texto', () => {
    expect(isActivePath('/cotacoes-antigas', '/cotacoes')).toBe(false);
  });
});

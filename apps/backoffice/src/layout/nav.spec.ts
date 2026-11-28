import {
  activeHref,
  buildNav,
  isActivePath,
  type NavItem,
  navItems,
} from './nav';

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

  it('agrupa as rotas de processos em "Processos", marcado como beta, com o editor e as execuções como filhos', () => {
    const processes = navItems.find(
      (item) => item.kind === 'group' && item.name === 'Processos',
    );

    expect(processes).toMatchObject({
      badge: { text: 'Beta', color: 'info' },
      items: [
        { kind: 'link', name: 'Editor', href: '/processos' },
        { kind: 'link', name: 'Execuções', href: '/processos/execucao' },
      ],
    });
  });

  it('não repete como link solto a rota que já é filha de um grupo', () => {
    const looseLinks = navItems.flatMap((item) =>
      item.kind === 'link' ? [item.href] : [],
    );

    expect(looseLinks).toEqual(['/', '/quadro']);
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

  it('mantém o ícone e o selo do grupo que perdeu um filho', () => {
    const group: NavItem = {
      kind: 'group',
      name: 'Ocorrências',
      icon: ['512 512', '<path />'],
      badge: { text: 'Beta', color: 'info' },
      items: [
        {
          kind: 'link',
          name: 'Abertas',
          href: '/ocorrencias',
          permission: 'operations:read',
        },
        { kind: 'link', name: 'Relatórios', href: '/ocorrencias/relatorios' },
      ],
    };

    expect(buildNav([group], new Set())).toEqual([
      { ...group, items: [group.items[1]] },
    ]);
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

describe('activeHref', () => {
  const active = (pathname: string, menu: readonly NavItem[] = items) =>
    activeHref({ pathname, items: menu });

  it('ativa o link solto na própria rota e nas rotas abaixo dela', () => {
    expect(active('/cotacoes')).toBe('/cotacoes');
    expect(active('/cotacoes/42')).toBe('/cotacoes');
  });

  it('ativa o filho do grupo na rota dele', () => {
    expect(active('/ocorrencias')).toBe('/ocorrencias');
  });

  it('entre dois filhos que casam com a rota, ativa só o de endereço mais específico', () => {
    expect(active('/ocorrencias/relatorios')).toBe('/ocorrencias/relatorios');
    expect(active('/ocorrencias/relatorios/2026')).toBe(
      '/ocorrencias/relatorios',
    );
  });

  it('escolhe o mais específico em qualquer ordem dos itens', () => {
    const reversed: NavItem[] = [
      { kind: 'link', name: 'Relatórios', href: '/ocorrencias/relatorios' },
      { kind: 'link', name: 'Abertas', href: '/ocorrencias' },
    ];

    expect(active('/ocorrencias/relatorios', reversed)).toBe(
      '/ocorrencias/relatorios',
    );
  });

  it('na rota abaixo do pai que não é a de outro filho, ativa o pai', () => {
    expect(active('/ocorrencias/42')).toBe('/ocorrencias');
  });

  it('não ativa nada na rota que nenhum item cobre, nem pelo título de seção', () => {
    expect(active('/sem-acesso')).toBeUndefined();
    expect(active('/')).toBeUndefined();
  });

  it('no menu do painel, ativa "Execuções" na rota das execuções e "Editor" na do editor', () => {
    expect(active('/processos/execucao', navItems)).toBe('/processos/execucao');
    expect(active('/processos', navItems)).toBe('/processos');
    expect(active('/', navItems)).toBe('/');
  });
});

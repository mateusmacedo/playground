import { cilColumns, cilHome, cilSitemap } from '@coreui/icons';

/** Ícone no formato do `@coreui/icons` (`[viewBox, svg]`), passado direto ao `CIcon`. */
export type NavIcon = string[];

export interface NavBadge {
  readonly text: string;
  readonly color:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'info'
    | 'warning'
    | 'danger';
}

/** Rótulo de seção; some quando nenhum item da seção sobra para o usuário. */
export interface NavTitle {
  readonly kind: 'title';
  readonly name: string;
}

export interface NavLink {
  readonly kind: 'link';
  readonly name: string;
  readonly href: string;
  readonly icon?: NavIcon;
  readonly badge?: NavBadge;
  /** Sem `permission`, o item aparece para qualquer sessão. */
  readonly permission?: string;
}

/** Submenu recolhível; some quando nenhum filho sobra para o usuário. */
export interface NavGroup {
  readonly kind: 'group';
  readonly name: string;
  readonly icon?: NavIcon;
  readonly badge?: NavBadge;
  readonly items: readonly NavLink[];
}

export type NavItem = NavTitle | NavLink | NavGroup;

/**
 * Menu lateral do painel. As páginas novas entram aqui e em `routes.ts`, para o breadcrumb. A rota que é filha de
 * outra entra como filho do grupo do pai, e a própria rota do pai vira o primeiro filho.
 */
export const navItems: readonly NavItem[] = [
  { kind: 'link', name: 'Início', href: '/', icon: cilHome },
  {
    kind: 'link',
    name: 'Quadro',
    href: '/quadro',
    icon: cilColumns,
    badge: { text: 'Beta', color: 'info' },
  },
  {
    kind: 'group',
    name: 'Processos',
    icon: cilSitemap,
    badge: { text: 'Beta', color: 'info' },
    items: [
      { kind: 'link', name: 'Editor', href: '/processos' },
      { kind: 'link', name: 'Execuções', href: '/processos/execucao' },
    ],
  },
];

/** Tira do menu o que a sessão não libera, os grupos que ficaram sem filhos e os títulos que ficaram sem itens. */
export function buildNav(
  items: readonly NavItem[],
  permissions: ReadonlySet<string>,
): NavItem[] {
  const allowed = (link: NavLink) =>
    !link.permission || permissions.has(link.permission);
  const visible = items.flatMap((item): NavItem[] => {
    if (item.kind === 'link') {
      return allowed(item) ? [item] : [];
    }
    if (item.kind === 'group') {
      const children = item.items.filter(allowed);
      return children.length ? [{ ...item, items: children }] : [];
    }
    return [item];
  });
  return visible.filter(
    (item, index) =>
      item.kind !== 'title' || hasEntryBeforeNextTitle(visible, index),
  );
}

function hasEntryBeforeNextTitle(
  items: readonly NavItem[],
  titleIndex: number,
): boolean {
  const next = items[titleIndex + 1];
  return !!next && next.kind !== 'title';
}

/** O endereço casa com a própria rota e com as rotas abaixo dela; a raiz só com a raiz. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function linksOf(items: readonly NavItem[]): readonly NavLink[] {
  const links: NavLink[] = [];
  for (const item of items) {
    if (item.kind === 'link') {
      links.push(item);
    }
    if (item.kind === 'group') {
      links.push(...item.items);
    }
  }
  return links;
}

export interface ActiveHrefParams {
  readonly pathname: string;
  readonly items: readonly NavItem[];
}

/**
 * Endereço do item ativo do menu: entre os links que casam com a rota, só o mais específico, que é o de endereço mais
 * longo. Em `/processos/execucao` fica ativo "Execuções", e não "Editor", cujo endereço é prefixo do dela. `undefined`
 * quando nenhum item casa.
 */
export function activeHref(params: ActiveHrefParams): string | undefined {
  const { pathname, items } = params;
  let active: string | undefined;
  for (const link of linksOf(items)) {
    if (!isActivePath(pathname, link.href)) {
      continue;
    }
    if (active === undefined || link.href.length > active.length) {
      active = link.href;
    }
  }
  return active;
}

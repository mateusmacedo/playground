import { cilColumns, cilHome } from '@coreui/icons';

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
  readonly items: readonly NavLink[];
}

export type NavItem = NavTitle | NavLink | NavGroup;

/** Menu lateral do painel. As páginas novas entram aqui e em `routes.ts`, para o breadcrumb. */
export const navItems: readonly NavItem[] = [
  { kind: 'link', name: 'Início', href: '/', icon: cilHome },
  { kind: 'link', name: 'Quadro', href: '/quadro', icon: cilColumns },
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

/** O item fica ativo na própria rota e nas rotas abaixo dela; a raiz só na raiz. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

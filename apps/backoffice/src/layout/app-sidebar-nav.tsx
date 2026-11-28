'use client';

import CIcon from '@coreui/icons-react';
import {
  CBadge,
  CNavGroup,
  CNavItem,
  CNavLink,
  CNavTitle,
  CSidebarNav,
} from '@coreui/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SimpleBar from 'simplebar-react';

import {
  activeHref,
  type NavBadge,
  type NavIcon,
  type NavItem,
  type NavLink,
} from './nav';

interface NavLabelProps {
  readonly name: string;
  readonly icon?: NavIcon;
  readonly badge?: NavBadge;
  readonly indent?: boolean;
  /** No botão que abre o grupo, o selo fica junto do nome: a ponta direita é da seta do grupo. */
  readonly inToggler?: boolean;
}

function NavLabel({
  name,
  icon,
  badge,
  indent = false,
  inToggler = false,
}: Readonly<NavLabelProps>) {
  return (
    <>
      {icon ? (
        <CIcon customClassName="nav-icon" icon={icon} />
      ) : (
        indent && (
          <span className="nav-icon">
            <span className="nav-icon-bullet" />
          </span>
        )
      )}
      {name}
      {badge && (
        <CBadge
          className={inToggler ? 'ms-2' : 'ms-auto'}
          color={badge.color}
          size="sm"
        >
          {badge.text}
        </CBadge>
      )}
    </>
  );
}

export interface AppSidebarNavProps {
  readonly items: readonly NavItem[];
}

/**
 * Itens do menu lateral, com rolagem própria. Só o item mais específico da rota atual fica marcado, e o grupo que o
 * contém abre.
 *
 * NOTE: quem expõe o estado ao leitor de tela é o CoreUI: o link ativo sai com `aria-current="page"`, e o botão do
 * grupo, com `aria-expanded`.
 */
export function AppSidebarNav({ items }: Readonly<AppSidebarNavProps>) {
  const pathname = usePathname();
  const active = activeHref({ pathname, items });

  const renderLink = (link: NavLink, indent = false) => (
    <CNavItem as="div" key={link.href}>
      <CNavLink active={link.href === active} as={Link} href={link.href}>
        <NavLabel
          badge={link.badge}
          icon={link.icon}
          indent={indent}
          name={link.name}
        />
      </CNavLink>
    </CNavItem>
  );

  return (
    <CSidebarNav as={SimpleBar}>
      {items.map((item) => {
        if (item.kind === 'title') {
          return (
            <CNavTitle as="div" key={`title:${item.name}`}>
              {item.name}
            </CNavTitle>
          );
        }
        if (item.kind === 'group') {
          return (
            <CNavGroup
              as="div"
              compact
              key={`group:${item.name}`}
              toggler={
                <NavLabel
                  badge={item.badge}
                  icon={item.icon}
                  inToggler
                  name={item.name}
                />
              }
              visible={item.items.some((link) => link.href === active)}
            >
              {item.items.map((link) => renderLink(link, true))}
            </CNavGroup>
          );
        }
        return renderLink(item);
      })}
    </CSidebarNav>
  );
}

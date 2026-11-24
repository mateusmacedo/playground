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
  isActivePath,
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
}

function NavLabel({
  name,
  icon,
  badge,
  indent = false,
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
        <CBadge className="ms-auto" color={badge.color} size="sm">
          {badge.text}
        </CBadge>
      )}
    </>
  );
}

export interface AppSidebarNavProps {
  readonly items: readonly NavItem[];
}

/** Itens do menu lateral, com rolagem própria e o item da rota atual marcado. */
export function AppSidebarNav({ items }: Readonly<AppSidebarNavProps>) {
  const pathname = usePathname();

  const renderLink = (link: NavLink, indent = false) => (
    <CNavItem as="div" key={link.href}>
      <CNavLink
        active={isActivePath(pathname, link.href)}
        as={Link}
        href={link.href}
      >
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
              toggler={<NavLabel icon={item.icon} name={item.name} />}
              visible={item.items.some((link) =>
                isActivePath(pathname, link.href),
              )}
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

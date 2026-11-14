'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  CCloseButton,
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarHeader,
  CSidebarToggler,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';

import { appConfig } from '@/core/config/app-config';
import { useSession } from '@/core/session/session-context';
import { logo, signet } from '@/icons/brand';

import { AppSidebarNav } from './app-sidebar-nav';
import { buildNav, navItems } from './nav';
import { useShell } from './shell-context';

/** Menu lateral escuro e fixo, com a marca, os itens que a sessão libera e o botão que estreita o menu no desktop. */
export function AppSidebar() {
  const {
    sidebarVisible,
    setSidebarVisible,
    sidebarUnfoldable,
    toggleSidebarUnfoldable,
  } = useShell();
  const { permissions } = useSession();
  const items = useMemo(() => buildNav(navItems, permissions), [permissions]);

  return (
    <CSidebar
      className="border-end d-print-none"
      colorScheme="dark"
      id="sidebar"
      onVisibleChange={setSidebarVisible}
      position="fixed"
      unfoldable={sidebarUnfoldable}
      visible={sidebarVisible}
    >
      <CSidebarHeader className="border-bottom">
        <CSidebarBrand aria-label={appConfig.appName} as={Link} href="/">
          <CIcon customClassName="sidebar-brand-full" height={32} icon={logo} />
          <CIcon
            customClassName="sidebar-brand-narrow"
            height={32}
            icon={signet}
          />
        </CSidebarBrand>
        <CCloseButton
          aria-label="Fechar o menu lateral"
          className="d-lg-none"
          dark
          onClick={() => setSidebarVisible(false)}
        />
      </CSidebarHeader>
      <AppSidebarNav items={items} />
      <CSidebarFooter className="border-top d-none d-lg-flex">
        <CSidebarToggler
          aria-label="Recolher ou expandir o menu lateral"
          onClick={toggleSidebarUnfoldable}
        />
      </CSidebarFooter>
    </CSidebar>
  );
}

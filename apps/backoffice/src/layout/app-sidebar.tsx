'use client';

import CIcon from '@coreui/icons-react';
import {
  CCloseButton,
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarHeader,
  CSidebarToggler,
} from '@coreui/react';
import Link from 'next/link';
import { type FocusEvent, useMemo, useState } from 'react';

import { appConfig } from '@/core/config/app-config';
import { useSession } from '@/core/session/session-context';
import { logo, signet } from '@/icons/brand';

import { AppSidebarNav } from './app-sidebar-nav';
import { buildNav, navItems } from './nav';
import { useShell } from './shell-context';

/** O foco chegou pelo teclado, e não por um clique. */
function focusedByKeyboard(target: Element): boolean {
  try {
    return target.matches(':focus-visible');
  } catch {
    // WHY: o navegador que não conhece `:focus-visible` recusa o seletor. Aí o foco conta como de teclado: o menu
    // aberto a mais é melhor que o item fora de alcance.
    return true;
  }
}

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
  // WHY: estreito, o menu só mostra os filhos de um grupo com o ponteiro em cima dele. Quem navega pelo teclado não
  // tem ponteiro, então o menu fica inteiro enquanto o foco do teclado está nele e volta a estreitar quando sai.
  const [keyboardInside, setKeyboardInside] = useState(false);

  function handleFocus(event: FocusEvent<HTMLElement>) {
    if (focusedByKeyboard(event.target)) {
      setKeyboardInside(true);
    }
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setKeyboardInside(false);
    }
  }

  return (
    <CSidebar
      // WHY: <nav> dá ao menu o papel `navigation`, para leitor de tela e para o e2e acharem o menu sem depender do id.
      aria-label="Menu lateral"
      as="nav"
      className="border-end d-print-none"
      colorScheme="dark"
      id="sidebar"
      onBlur={handleBlur}
      onFocus={handleFocus}
      onVisibleChange={setSidebarVisible}
      position="fixed"
      unfoldable={sidebarUnfoldable && !keyboardInside}
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

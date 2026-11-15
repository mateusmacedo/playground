'use client';

import {
  cilAccountLogout,
  cilContrast,
  cilMenu,
  cilMoon,
  cilSun,
  cilUser,
} from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import {
  CAvatar,
  CContainer,
  CDropdown,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
} from '@coreui/react';
import { useEffect, useRef } from 'react';

import { useSession } from '@/core/session/session-context';
import { useColorMode } from '@/shared/hooks/use-color-mode';
import { useIsClient } from '@/shared/hooks/use-is-client';

import { AppBreadcrumb } from './app-breadcrumb';
import { THEME_STORAGE_KEY } from './color-mode';
import { useShell } from './shell-context';

const COLOR_MODES = [
  { name: 'light', label: 'Claro', icon: cilSun },
  { name: 'dark', label: 'Escuro', icon: cilMoon },
  { name: 'auto', label: 'Automático', icon: cilContrast },
] as const;

function HeaderDivider() {
  return (
    <li className="nav-item py-1">
      <div className="vr h-100 mx-2 text-body text-opacity-75" />
    </li>
  );
}

/**
 * Cabeçalho do painel, como o do template grátis do CoreUI: mostra e esconde o menu lateral, escolhe o tema (claro,
 * escuro ou automático), mostra o usuário com a saída e o breadcrumb da rota.
 */
export function AppHeader() {
  const headerRef = useRef<HTMLDivElement>(null);
  const { sidebarVisible, setSidebarVisible } = useShell();
  const { user, signOut } = useSession();
  const { colorMode, setColorMode } = useColorMode(THEME_STORAGE_KEY);
  // WHY: o tema salvo só existe no navegador; antes da hidratação o ícone fica neutro para não divergir do servidor.
  const isClient = useIsClient();
  const currentMode = isClient
    ? COLOR_MODES.find((mode) => mode.name === colorMode)
    : undefined;

  useEffect(() => {
    const handleScroll = () =>
      headerRef.current?.classList.toggle(
        'shadow-sm',
        document.documentElement.scrollTop > 0,
      );
    document.addEventListener('scroll', handleScroll, { passive: true });
    return () => document.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    // WHY: o CHeader renderiza uma div sem landmark, e envolvê-lo num <header>
    // quebraria o position="sticky"; o role dá ao cabeçalho a semântica de
    // <header> para leitores de tela, como o rodapé faz com contentinfo.
    <CHeader
      className="mb-4 p-0 d-print-none"
      position="sticky"
      ref={headerRef}
      role="banner"
    >
      <CContainer className="border-bottom px-4" fluid>
        <CHeaderToggler
          aria-controls="sidebar"
          aria-label="Mostrar ou esconder o menu lateral"
          onClick={() => setSidebarVisible(!sidebarVisible)}
          style={{ marginInlineStart: '-14px' }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>
        <CHeaderNav className="ms-auto">
          <HeaderDivider />
          <CDropdown placement="bottom-end" variant="nav-item">
            <CDropdownToggle aria-label="Escolher o tema" caret={false}>
              <CIcon icon={currentMode?.icon ?? cilContrast} size="lg" />
            </CDropdownToggle>
            <CDropdownMenu>
              {COLOR_MODES.map((mode) => (
                <CDropdownItem
                  active={currentMode?.name === mode.name}
                  as="button"
                  className="d-flex align-items-center"
                  key={mode.name}
                  onClick={() => setColorMode(mode.name)}
                  type="button"
                >
                  <CIcon className="me-2" icon={mode.icon} size="lg" />
                  {mode.label}
                </CDropdownItem>
              ))}
            </CDropdownMenu>
          </CDropdown>
          <HeaderDivider />
        </CHeaderNav>
        <CHeaderNav className="mx-0">
          <CDropdown placement="bottom-end" variant="nav-item">
            <CDropdownToggle
              aria-label="Abrir o menu do usuário"
              caret={false}
              className="py-0 pe-0"
            >
              <CAvatar
                color="secondary"
                shape="rounded-1"
                size="md"
                textColor="white"
              >
                <CIcon icon={cilUser} />
              </CAvatar>
            </CDropdownToggle>
            <CDropdownMenu className="pt-0 w-auto">
              <CDropdownHeader className="bg-body-secondary text-body-secondary fw-semibold py-2 rounded-top">
                {user?.displayName ?? 'Conta'}
                {user?.organization && (
                  <span className="d-block small fw-normal">
                    {user.organization}
                  </span>
                )}
              </CDropdownHeader>
              {signOut && (
                <CDropdownItem as="button" onClick={signOut} type="button">
                  <CIcon className="me-2" icon={cilAccountLogout} />
                  Sair
                </CDropdownItem>
              )}
            </CDropdownMenu>
          </CDropdown>
        </CHeaderNav>
      </CContainer>
      <CContainer className="px-4" fluid>
        <AppBreadcrumb />
      </CContainer>
    </CHeader>
  );
}

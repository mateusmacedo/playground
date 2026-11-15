'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface ShellState {
  readonly sidebarVisible: boolean;
  readonly setSidebarVisible: (visible: boolean) => void;
  /** Menu estreito no desktop, que abre ao passar o mouse. */
  readonly sidebarUnfoldable: boolean;
  readonly toggleSidebarUnfoldable: () => void;
}

const ShellContext = createContext<ShellState | null>(null);

/** Estado do menu lateral, compartilhado entre o próprio menu e o botão do cabeçalho que o mostra e esconde. */
export function ShellProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarUnfoldable, setSidebarUnfoldable] = useState(false);
  const value = useMemo<ShellState>(
    () => ({
      sidebarVisible,
      setSidebarVisible,
      sidebarUnfoldable,
      toggleSidebarUnfoldable: () =>
        setSidebarUnfoldable((current) => !current),
    }),
    [sidebarVisible, sidebarUnfoldable],
  );
  return <ShellContext value={value}>{children}</ShellContext>;
}

export function useShell(): ShellState {
  const shell = useContext(ShellContext);
  if (!shell) {
    throw new Error('useShell precisa estar dentro do ShellProvider.');
  }
  return shell;
}

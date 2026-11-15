import { useCallback, useEffect, useState } from 'react';

export type ColorMode = 'light' | 'dark' | 'auto';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function isColorMode(value: string | null): value is ColorMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

function readStoredMode(storageKey: string): ColorMode {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (isColorMode(stored)) {
      return stored;
    }
  } catch {
    // WHY: armazenamento bloqueado ou indisponível (modo privado, política do navegador, render no servidor) não pode
    // derrubar o cabeçalho; sem escolha salva o tema segue o sistema.
  }
  return 'auto';
}

function writeStoredMode(storageKey: string, mode: ColorMode): void {
  try {
    window.localStorage.setItem(storageKey, mode);
  } catch {
    // WHY: com o armazenamento cheio ou bloqueado, a escolha vale só nesta sessão da página, guardada no estado do
    // hook; perdê-la ao recarregar é melhor do que quebrar a troca de tema.
  }
}

function resolveTheme(mode: ColorMode): 'light' | 'dark' {
  if (mode !== 'auto') {
    return mode;
  }
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}

function applyColorMode(mode: ColorMode): void {
  document.documentElement.dataset.coreuiTheme = resolveTheme(mode);
  // NOTE: os gráficos do CoreUI escutam este evento para se repintar; o `useColorModes` do CoreUI também o dispara.
  document.documentElement.dispatchEvent(new Event('ColorSchemeChange'));
}

/**
 * Tema do painel (claro, escuro ou automático), guardado no `localStorage` sob `storageKey`. Sem escolha salva o modo
 * é `auto` e acompanha o sistema, como o script de bootstrap de `layout/color-mode.ts`. A escolha só é salva quando
 * a pessoa troca o tema.
 */
export function useColorMode(storageKey: string): {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
} {
  const [colorMode, setColorModeState] = useState<ColorMode>(() =>
    readStoredMode(storageKey),
  );

  useEffect(() => {
    applyColorMode(colorMode);
    if (colorMode !== 'auto') {
      return;
    }
    const systemScheme = window.matchMedia(DARK_SCHEME_QUERY);
    const followSystem = () => applyColorMode('auto');
    systemScheme.addEventListener('change', followSystem);
    return () => systemScheme.removeEventListener('change', followSystem);
  }, [colorMode]);

  const setColorMode = useCallback(
    (mode: ColorMode) => {
      setColorModeState(mode);
      writeStoredMode(storageKey, mode);
    },
    [storageKey],
  );

  return { colorMode, setColorMode };
}

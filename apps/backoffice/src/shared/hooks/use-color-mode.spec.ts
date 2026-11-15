import { act, renderHook } from '@testing-library/react';

import { useColorMode } from './use-color-mode';

const KEY = 'tema-de-teste';

type SchemeListener = () => void;

function stubSystemScheme(initiallyDark: boolean) {
  const listeners = new Set<SchemeListener>();
  const scheme = {
    matches: initiallyDark,
    addEventListener: (_type: string, listener: SchemeListener) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: SchemeListener) =>
      listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => scheme);
  return {
    switchTo: (dark: boolean) => {
      scheme.matches = dark;
      for (const listener of listeners) {
        listener();
      }
    },
    listenerCount: () => listeners.size,
  };
}

const appliedTheme = () => document.documentElement.dataset.coreuiTheme;

describe('useColorMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-coreui-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sem escolha salva fica em automático e segue o sistema', () => {
    stubSystemScheme(true);

    const { result } = renderHook(() => useColorMode(KEY));

    expect(result.current.colorMode).toBe('auto');
    expect(appliedTheme()).toBe('dark');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('usa a escolha salva em vez do sistema', () => {
    stubSystemScheme(true);
    localStorage.setItem(KEY, 'light');

    const { result } = renderHook(() => useColorMode(KEY));

    expect(result.current.colorMode).toBe('light');
    expect(appliedTheme()).toBe('light');
  });

  it('ignora um valor salvo que não é um modo conhecido', () => {
    stubSystemScheme(false);
    localStorage.setItem(KEY, 'sepia');

    const { result } = renderHook(() => useColorMode(KEY));

    expect(result.current.colorMode).toBe('auto');
    expect(appliedTheme()).toBe('light');
  });

  it('salva a escolha e aplica o tema', () => {
    stubSystemScheme(false);
    const { result } = renderHook(() => useColorMode(KEY));

    act(() => result.current.setColorMode('dark'));

    expect(result.current.colorMode).toBe('dark');
    expect(appliedTheme()).toBe('dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it('em automático acompanha a mudança do sistema, e deixa de acompanhar numa escolha fixa', () => {
    const system = stubSystemScheme(false);
    const { result } = renderHook(() => useColorMode(KEY));
    expect(appliedTheme()).toBe('light');

    act(() => system.switchTo(true));
    expect(appliedTheme()).toBe('dark');

    act(() => result.current.setColorMode('light'));
    expect(system.listenerCount()).toBe(0);
    act(() => system.switchTo(false));
    act(() => system.switchTo(true));
    expect(appliedTheme()).toBe('light');
  });

  it('com o armazenamento bloqueado na leitura, não quebra e segue o sistema', () => {
    stubSystemScheme(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });

    const { result } = renderHook(() => useColorMode(KEY));

    expect(result.current.colorMode).toBe('auto');
    expect(appliedTheme()).toBe('dark');
  });

  it('com o armazenamento cheio na escrita, a escolha vale em memória', () => {
    stubSystemScheme(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useColorMode(KEY));

    act(() => result.current.setColorMode('dark'));

    expect(result.current.colorMode).toBe('dark');
    expect(appliedTheme()).toBe('dark');
  });

  it('avisa os gráficos do CoreUI quando o tema muda', () => {
    stubSystemScheme(false);
    const onChange = vi.fn();
    document.documentElement.addEventListener('ColorSchemeChange', onChange);
    const { result } = renderHook(() => useColorMode(KEY));
    onChange.mockClear();

    act(() => result.current.setColorMode('dark'));

    expect(onChange).toHaveBeenCalledTimes(1);
    document.documentElement.removeEventListener('ColorSchemeChange', onChange);
  });
});

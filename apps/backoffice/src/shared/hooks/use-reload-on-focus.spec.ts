import { renderHook } from '@testing-library/react';

import { useReloadOnFocus } from './use-reload-on-focus';

type Visibility = 'visible' | 'hidden';

let visibility: Visibility = 'visible';

function setVisibility(next: Visibility): void {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}

function blurWindow(): void {
  window.dispatchEvent(new Event('blur'));
}

function focusWindow(): void {
  window.dispatchEvent(new Event('focus'));
}

describe('useReloadOnFocus', () => {
  beforeEach(() => {
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => visibility,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não relê enquanto a pessoa não saiu da aba', () => {
    const reload = vi.fn();
    renderHook(() => useReloadOnFocus({ reload }));

    focusWindow();

    expect(reload).not.toHaveBeenCalled();
  });

  it('relê quando a janela volta a ter o foco', () => {
    const reload = vi.fn();
    renderHook(() => useReloadOnFocus({ reload }));

    blurWindow();
    expect(reload).not.toHaveBeenCalled();
    focusWindow();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('relê quando a aba volta a ficar visível', () => {
    const reload = vi.fn();
    renderHook(() => useReloadOnFocus({ reload }));

    setVisibility('hidden');
    expect(reload).not.toHaveBeenCalled();
    setVisibility('visible');

    expect(reload).toHaveBeenCalledOnce();
  });

  it('relê uma vez só quando a visibilidade e o foco voltam juntos', () => {
    const reload = vi.fn();
    renderHook(() => useReloadOnFocus({ reload }));

    setVisibility('hidden');
    blurWindow();
    setVisibility('visible');
    focusWindow();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('relê de novo a cada volta', () => {
    const reload = vi.fn();
    renderHook(() => useReloadOnFocus({ reload }));

    blurWindow();
    focusWindow();
    blurWindow();
    focusWindow();

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('relê na primeira vez que aparece a tela aberta numa aba de fundo', () => {
    visibility = 'hidden';
    const reload = vi.fn();
    renderHook(() => useReloadOnFocus({ reload }));

    setVisibility('visible');

    expect(reload).toHaveBeenCalledOnce();
  });

  it('desligado, não relê na volta nem depois, sem uma nova saída', () => {
    const reload = vi.fn();
    const { rerender } = renderHook(
      (enabled: boolean) => useReloadOnFocus({ reload, enabled }),
      { initialProps: false },
    );

    blurWindow();
    focusWindow();
    rerender(true);
    focusWindow();

    expect(reload).not.toHaveBeenCalled();
  });

  it('vale o que estiver ligado na hora da volta', () => {
    const reload = vi.fn();
    const { rerender } = renderHook(
      (enabled: boolean) => useReloadOnFocus({ reload, enabled }),
      { initialProps: false },
    );

    blurWindow();
    rerender(true);
    focusWindow();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('chama a função de releitura da renderização mais recente', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = renderHook(
      (reload: () => void) => useReloadOnFocus({ reload }),
      { initialProps: first },
    );

    rerender(latest);
    blurWindow();
    focusWindow();

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it('para de ouvir quando a tela sai', () => {
    const reload = vi.fn();
    const { unmount } = renderHook(() => useReloadOnFocus({ reload }));

    unmount();
    blurWindow();
    focusWindow();
    setVisibility('hidden');
    setVisibility('visible');

    expect(reload).not.toHaveBeenCalled();
  });
});

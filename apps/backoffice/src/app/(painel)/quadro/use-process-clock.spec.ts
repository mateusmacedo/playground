import { act, renderHook } from '@testing-library/react';

import { CLOCK_TICK_MS, useProcessClock } from './use-process-clock';

const START = '2026-11-26T12:00:00.000Z';

describe('useProcessClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(START));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('entrega o instante atual depois de montar', () => {
    const { result } = renderHook(() => useProcessClock(true));

    expect(result.current).toBe(START);
  });

  it('lê o instante de novo a cada minuto', () => {
    const { result } = renderHook(() => useProcessClock(true));

    act(() => {
      vi.advanceTimersByTime(CLOCK_TICK_MS);
    });

    expect(result.current).toBe('2026-11-26T12:01:00.000Z');
  });

  it('desligado, não entrega instante nem acompanha o relógio', () => {
    const { result } = renderHook(() => useProcessClock(false));

    act(() => {
      vi.advanceTimersByTime(CLOCK_TICK_MS);
    });

    expect(result.current).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('para de entregar o instante quando é desligado', () => {
    const { result, rerender } = renderHook(
      (enabled: boolean) => useProcessClock(enabled),
      { initialProps: true },
    );

    rerender(false);

    expect(result.current).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('para de acompanhar o relógio quando a tela sai', () => {
    const { unmount } = renderHook(() => useProcessClock(true));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

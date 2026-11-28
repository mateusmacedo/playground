import { act, renderHook } from '@testing-library/react';

import type { WriteOutcome } from './serial-writer';
import { useSerialWriter } from './use-serial-writer';

const DELAY = 200;

type Write = (value: string) => Promise<string>;
type Settled = (outcome: WriteOutcome<string, string>) => void;

interface HookProps {
  readonly write: Write;
  readonly onSettled?: Settled;
}

function renderWriter(initial: HookProps) {
  return renderHook(
    (props: HookProps) => useSerialWriter({ ...props, delayMs: DELAY }),
    { initialProps: initial },
  );
}

/** Avança o relógio e deixa o React aplicar o estado que os envios mudaram. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useSerialWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('começa sem pendência', () => {
    const { result } = renderWriter({ write: vi.fn<Write>() });

    expect(result.current.pending).toBe(false);
  });

  it('fica pendente do valor marcado até o envio terminar', async () => {
    const write = vi.fn<Write>(async () => 'ok');
    const { result } = renderWriter({ write });

    act(() => result.current.schedule('a'));
    expect(result.current.pending).toBe(true);
    await advance(DELAY);

    expect(write).toHaveBeenCalledExactlyOnceWith('a');
    expect(result.current.pending).toBe(false);
  });

  it('avisa o fim do envio com o valor e o resultado', async () => {
    const onSettled = vi.fn<Settled>();
    const { result } = renderWriter({
      write: async () => 'gravado',
      onSettled,
    });

    act(() => result.current.schedule('a'));
    await advance(DELAY);

    expect(onSettled).toHaveBeenCalledExactlyOnceWith({
      value: 'a',
      result: 'gravado',
    });
  });

  it('envia com a função da renderização mais recente', async () => {
    const first = vi.fn<Write>(async () => 'primeira');
    const latest = vi.fn<Write>(async () => 'atual');
    const { result, rerender } = renderWriter({ write: first });

    act(() => result.current.schedule('a'));
    rerender({ write: latest });
    await advance(DELAY);

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledExactlyOnceWith('a');
  });

  it('entrega as mesmas funções a cada renderização', () => {
    const write = vi.fn<Write>();
    const { result, rerender } = renderWriter({ write });
    const before = result.current;

    rerender({ write });

    expect(result.current.schedule).toBe(before.schedule);
    expect(result.current.flush).toBe(before.flush);
    expect(result.current.cancel).toBe(before.cancel);
  });

  it('flush envia sem esperar o intervalo', async () => {
    const write = vi.fn<Write>(async () => 'ok');
    const { result } = renderWriter({ write });
    act(() => result.current.schedule('a'));

    await act(async () => {
      await result.current.flush();
    });

    expect(write).toHaveBeenCalledExactlyOnceWith('a');
    expect(result.current.pending).toBe(false);
  });

  it('cancel desiste do valor marcado', async () => {
    const write = vi.fn<Write>(async () => 'ok');
    const { result } = renderWriter({ write });
    act(() => result.current.schedule('a'));

    act(() => result.current.cancel());
    await advance(DELAY);

    expect(write).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });

  it('envia na hora o valor que esperava quando a tela sai', async () => {
    const write = vi.fn<Write>(async () => 'ok');
    const { result, unmount } = renderWriter({ write });
    act(() => result.current.schedule('a'));

    unmount();
    await advance(0);

    expect(write).toHaveBeenCalledExactlyOnceWith('a');
  });
});

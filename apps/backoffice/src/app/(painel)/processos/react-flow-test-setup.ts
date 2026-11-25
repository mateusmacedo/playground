/**
 * O que o React Flow precisa e o jsdom não tem, como manda o guia de testes do React Flow: `ResizeObserver`,
 * `DOMMatrixReadOnly` e medidas de elemento. Chame no topo de cada spec que renderiza o canvas.
 */
export function mockReactFlow(): void {
  class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      setTimeout(() => {
        this.callback([{ target } as ResizeObserverEntry], this);
      }, 0);
    }

    unobserve() {
      // NOTE: o mock não guarda alvos, então não há o que soltar.
    }

    disconnect() {
      // NOTE: idem, nada a desligar.
    }
  }

  class DOMMatrixReadOnlyMock {
    readonly m22: number;

    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([1-9.])\)/)?.[1];
      this.m22 = scale === undefined ? 1 : Number(scale);
    }
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  vi.stubGlobal('DOMMatrixReadOnly', DOMMatrixReadOnlyMock);
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return Number.parseFloat(this.style.height) || 1;
      },
    },
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return Number.parseFloat(this.style.width) || 1;
      },
    },
  });
}

import { createEvent, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

export type DragKind =
  | 'dragStart'
  | 'dragOver'
  | 'dragLeave'
  | 'drop'
  | 'dragEnd';

/** O `dataTransfer` falso do evento, com as funções que o quadro chama. */
export interface FakeDataTransfer {
  readonly setData: ReturnType<typeof vi.fn>;
  readonly setDragImage: ReturnType<typeof vi.fn>;
  effectAllowed: string;
  dropEffect: string;
}

export function fakeDataTransfer(): FakeDataTransfer {
  return {
    setData: vi.fn(),
    setDragImage: vi.fn(),
    effectAllowed: 'none',
    dropEffect: 'none',
  };
}

/** Evento de arraste a disparar num elemento, com a posição do ponteiro e o elemento vizinho quando o teste precisa. */
export interface DragEventInput {
  readonly kind: DragKind;
  readonly element: Element;
  readonly clientX?: number;
  readonly clientY?: number;
  readonly relatedTarget?: Node | null;
  /** Passe um quando o teste precisa conferir o que o quadro gravou nele. */
  readonly dataTransfer?: FakeDataTransfer;
}

/**
 * Dispara um evento de arraste com `dataTransfer` falso e devolve `false` quando o evento foi cancelado.
 *
 * WHY: o jsdom não tem `DragEvent` e ignora `clientX`, `clientY` e `relatedTarget` no init de um evento genérico; por
 * isso esses campos entram por propriedade.
 */
export function fireDrag(input: DragEventInput): boolean {
  const {
    kind,
    element,
    dataTransfer = fakeDataTransfer(),
    ...pointer
  } = input;
  const event = createEvent[kind](element, { dataTransfer });
  for (const [key, value] of Object.entries(pointer)) {
    Object.defineProperty(event, key, { value });
  }
  return fireEvent(element, event);
}

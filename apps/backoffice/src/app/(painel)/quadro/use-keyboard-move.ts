import { type KeyboardEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { announcementText } from './announcements';
import { type BoardLane, type StepDirection, stepCard } from './board';

export interface KeyboardMove {
  readonly grabbedId: string | null;
  /** Solta o card pego, sem anúncio; usado quando outro meio assume o movimento. */
  readonly release: () => void;
  readonly onHandleClick: (cardId: string) => void;
  readonly onHandleKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    cardId: string,
  ) => void;
  readonly onHandleBlur: (cardId: string) => void;
  readonly registerHandle: (handle: {
    readonly cardId: string;
    readonly element: HTMLButtonElement | null;
  }) => void;
}

interface KeyboardGrab {
  readonly cardId: string;
  /** Quadro de antes de pegar o card, para o Esc desfazer o movimento. */
  readonly snapshot: readonly BoardLane[];
}

const STEP_KEYS: Readonly<Record<string, StepDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * Movimento pelo teclado na alça do card: o clique (Espaço, Enter ou toque) pega e solta, as setas movem e o Esc
 * desfaz. Cada passo vira um anúncio para o leitor de tela.
 */
export function useKeyboardMove(params: {
  readonly lanes: readonly BoardLane[];
  readonly setLanes: (lanes: readonly BoardLane[]) => void;
  readonly announce: (text: string) => void;
}): KeyboardMove {
  const { lanes, setLanes, announce } = params;
  const [grab, setGrab] = useState<KeyboardGrab | null>(null);
  const handles = useRef(new Map<string, HTMLButtonElement>());

  function focusHandle(cardId: string) {
    handles.current.get(cardId)?.focus();
  }

  function onHandleClick(cardId: string) {
    if (grab?.cardId === cardId) {
      setGrab(null);
      announce(announcementText({ kind: 'dropped', lanes, cardId }));
      return;
    }
    setGrab({ cardId, snapshot: lanes });
    announce(announcementText({ kind: 'grabbed', lanes, cardId }));
  }

  function cancel(grabbed: {
    readonly snapshot: readonly BoardLane[];
    readonly cardId: string;
  }) {
    const { snapshot, cardId } = grabbed;
    flushSync(() => {
      setLanes(snapshot);
      setGrab(null);
    });
    focusHandle(cardId);
    announce(announcementText({ kind: 'cancelled', lanes: snapshot, cardId }));
  }

  function step(move: {
    readonly cardId: string;
    readonly direction: StepDirection;
  }) {
    const { cardId, direction } = move;
    const next = stepCard({ lanes, cardId, direction });
    if (next === lanes) {
      return;
    }
    // WHY: na troca de coluna o card remonta em outra lista; o render síncrono deixa a alça nova pronta para o foco.
    flushSync(() => setLanes(next));
    focusHandle(cardId);
    announce(announcementText({ kind: 'moved', lanes: next, cardId }));
  }

  function onHandleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    cardId: string,
  ) {
    if (grab?.cardId !== cardId) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel({ snapshot: grab.snapshot, cardId });
      return;
    }
    const direction = STEP_KEYS[event.key];
    if (direction) {
      event.preventDefault();
      step({ cardId, direction });
    }
  }

  function onHandleBlur(cardId: string) {
    if (grab?.cardId !== cardId) {
      return;
    }
    // WHY: a remontagem na troca de coluna também tira o foco da alça antiga. Só solta o card se, depois do
    // render, o foco não voltou para a alça dele.
    queueMicrotask(() => {
      if (document.activeElement !== handles.current.get(cardId)) {
        setGrab((current) => (current?.cardId === cardId ? null : current));
      }
    });
  }

  function registerHandle(handle: {
    readonly cardId: string;
    readonly element: HTMLButtonElement | null;
  }) {
    if (handle.element) {
      handles.current.set(handle.cardId, handle.element);
    }
  }

  return {
    grabbedId: grab?.cardId ?? null,
    release: () => setGrab(null),
    onHandleClick,
    onHandleKeyDown,
    onHandleBlur,
    registerHandle,
  };
}

import { type KeyboardEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type { MoveAnnouncement } from './model/announcements';
import type { BoardLane, StepDirection } from './model/board';
import type { LaneDirection } from './model/lanes';

export interface HandleRegistration {
  readonly id: string;
  readonly element: HTMLButtonElement | null;
}

export interface KeyboardMove {
  readonly grabbedId: string | null;
  /** Solta o item pego, sem anúncio; usado quando outro meio assume o movimento. */
  readonly release: () => void;
  readonly onHandleClick: (id: string) => void;
  readonly onHandleKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    id: string,
  ) => void;
  readonly onHandleBlur: (id: string) => void;
  readonly registerHandle: (handle: HandleRegistration) => void;
}

interface KeyboardGrab {
  readonly id: string;
  /** Quadro de antes de pegar o item, para o Esc desfazer o movimento. */
  readonly snapshot: readonly BoardLane[];
}

/** Os cards andam nas quatro direções. */
export const CARD_STEP_KEYS: Readonly<Record<string, StepDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** As colunas só andam para os lados. */
export const LANE_STEP_KEYS: Readonly<Record<string, LaneDirection>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export interface MoveStep<Direction extends string> {
  readonly lanes: readonly BoardLane[];
  readonly id: string;
  readonly direction: Direction;
}

export interface MoveEvent {
  readonly kind: MoveAnnouncement;
  readonly lanes: readonly BoardLane[];
  readonly id: string;
}

interface GrabbedStep<Direction extends string> {
  readonly id: string;
  readonly direction: Direction;
}

export interface UseKeyboardMoveParams<Direction extends string> {
  readonly lanes: readonly BoardLane[];
  readonly setLanes: (lanes: readonly BoardLane[]) => void;
  readonly announce: (text: string) => void;
  readonly keys: Readonly<Record<string, Direction>>;
  /** Um passo na direção pedida; devolve o próprio `lanes` quando não há para onde ir. */
  readonly step: (move: MoveStep<Direction>) => readonly BoardLane[];
  readonly announcementFor: (event: MoveEvent) => string;
}

/**
 * Movimento pelo teclado na alça de um card ou de uma coluna: o clique (Espaço, Enter ou toque) pega e solta, as setas
 * movem e o Esc desfaz. Cada passo vira um anúncio para o leitor de tela.
 */
export function useKeyboardMove<Direction extends string>(
  params: UseKeyboardMoveParams<Direction>,
): KeyboardMove {
  const { lanes, setLanes, announce, keys, announcementFor } = params;
  const [grab, setGrab] = useState<KeyboardGrab | null>(null);
  const handles = useRef(new Map<string, HTMLButtonElement>());

  function focusHandle(id: string) {
    handles.current.get(id)?.focus();
  }

  function onHandleClick(id: string) {
    if (grab?.id === id) {
      setGrab(null);
      announce(announcementFor({ kind: 'dropped', lanes, id }));
      return;
    }
    setGrab({ id, snapshot: lanes });
    announce(announcementFor({ kind: 'grabbed', lanes, id }));
  }

  function cancel(grabbed: KeyboardGrab) {
    const { snapshot, id } = grabbed;
    flushSync(() => {
      setLanes(snapshot);
      setGrab(null);
    });
    focusHandle(id);
    announce(announcementFor({ kind: 'cancelled', lanes: snapshot, id }));
  }

  function step(move: GrabbedStep<Direction>) {
    const { id, direction } = move;
    const next = params.step({ lanes, id, direction });
    if (next === lanes) {
      return;
    }
    // WHY: na troca de lugar o item remonta ou muda de posição no DOM e perde o foco; o render síncrono deixa a alça
    // pronta para recebê-lo de volta.
    flushSync(() => setLanes(next));
    focusHandle(id);
    announce(announcementFor({ kind: 'moved', lanes: next, id }));
  }

  function onHandleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    id: string,
  ) {
    if (grab?.id !== id) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel(grab);
      return;
    }
    const direction = keys[event.key];
    if (direction) {
      event.preventDefault();
      step({ id, direction });
    }
  }

  function onHandleBlur(id: string) {
    if (grab?.id !== id) {
      return;
    }
    // WHY: a remontagem na troca de lugar também tira o foco da alça antiga. Só solta o item se, depois do render, o
    // foco não voltou para a alça dele.
    queueMicrotask(() => {
      if (document.activeElement !== handles.current.get(id)) {
        setGrab((current) => (current?.id === id ? null : current));
      }
    });
  }

  function registerHandle(handle: HandleRegistration) {
    if (handle.element) {
      handles.current.set(handle.id, handle.element);
    }
  }

  return {
    grabbedId: grab?.id ?? null,
    release: () => setGrab(null),
    onHandleClick,
    onHandleKeyDown,
    onHandleBlur,
    registerHandle,
  };
}

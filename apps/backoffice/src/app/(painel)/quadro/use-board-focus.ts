import { type RefObject, useRef } from 'react';

/** Atributos que marcam, na tela, os elementos que podem receber o foco depois de uma ação. */
export type FocusTarget =
  | 'data-card-open'
  | 'data-lane-title'
  | 'data-board-reset'
  | 'data-board-archive'
  | 'data-board-labels'
  | 'data-board-settings'
  | 'data-archive-lane'
  | 'data-board-undo';

/** Elemento marcado com `attribute` igual a `id`. */
export interface MarkedElement {
  readonly attribute: FocusTarget;
  readonly id: string;
}

export interface BoardFocus {
  /** Vai no elemento raiz do quadro; a busca pelos elementos marcados acontece dentro dele. */
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly focusMarked: (target: MarkedElement) => void;
  /** Foca o elemento depois que a tela se atualiza, porque ele ainda pode não estar nela. */
  readonly focusMarkedLater: (target: MarkedElement) => void;
  /** Foca o título da coluna depois que a tela se atualiza; sem coluna, não faz nada. */
  readonly focusLaneLater: (laneId: string | undefined) => void;
}

/** Devolve o foco a um elemento do quadro depois de uma ação que tirou da tela quem estava focado. */
export function useBoardFocus(): BoardFocus {
  const rootRef = useRef<HTMLDivElement>(null);

  function focusMarked(target: MarkedElement) {
    const marked =
      rootRef.current?.querySelectorAll<HTMLElement>(`[${target.attribute}]`) ??
      [];
    for (const element of marked) {
      if (element.getAttribute(target.attribute) === target.id) {
        element.focus();
        return;
      }
    }
  }

  function focusMarkedLater(target: MarkedElement) {
    requestAnimationFrame(() => focusMarked(target));
  }

  function focusLaneLater(laneId: string | undefined) {
    if (laneId) {
      focusMarkedLater({ attribute: 'data-lane-title', id: laneId });
    }
  }

  return { rootRef, focusMarked, focusMarkedLater, focusLaneLater };
}

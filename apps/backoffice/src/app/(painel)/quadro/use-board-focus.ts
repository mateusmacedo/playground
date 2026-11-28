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

/** Botão da visão aberta, na barra do quadro; cada botão de visão leva a marca `data-board-view`. */
const OPEN_VIEW_BUTTON = '[data-board-view][aria-pressed="true"]';

/** Elemento marcado com `attribute` igual a `id`. */
export interface MarkedElement {
  readonly attribute: FocusTarget;
  readonly id: string;
}

export interface BoardFocus {
  /** Vai no elemento raiz do quadro; a busca pelos elementos marcados acontece dentro dele. */
  readonly rootRef: RefObject<HTMLDivElement | null>;
  /** Foca o elemento marcado e diz se ele estava na tela. */
  readonly focusMarked: (target: MarkedElement) => boolean;
  /** Foca o elemento depois que a tela se atualiza, porque ele ainda pode não estar nela. */
  readonly focusMarkedLater: (target: MarkedElement) => void;
  /**
   * Foca o título da coluna depois que a tela se atualiza; sem coluna, não faz nada. Na visão que não mostra as
   * colunas, o foco vai para o botão dessa visão.
   */
  readonly focusLaneLater: (laneId: string | undefined) => void;
}

/** Devolve o foco a um elemento do quadro depois de uma ação que tirou da tela quem estava focado. */
export function useBoardFocus(): BoardFocus {
  const rootRef = useRef<HTMLDivElement>(null);

  function focusMarked(target: MarkedElement): boolean {
    const marked =
      rootRef.current?.querySelectorAll<HTMLElement>(`[${target.attribute}]`) ??
      [];
    for (const element of marked) {
      if (element.getAttribute(target.attribute) === target.id) {
        element.focus();
        return true;
      }
    }
    return false;
  }

  function focusOpenView() {
    rootRef.current?.querySelector<HTMLElement>(OPEN_VIEW_BUTTON)?.focus();
  }

  function focusMarkedLater(target: MarkedElement) {
    requestAnimationFrame(() => focusMarked(target));
  }

  function focusLaneLater(laneId: string | undefined) {
    if (!laneId) {
      return;
    }
    requestAnimationFrame(() => {
      const found = focusMarked({ attribute: 'data-lane-title', id: laneId });
      // WHY: a lista e a visão de etapas não mostram as colunas. Nelas o foco vai para o botão da visão aberta, que
      // está sempre na tela, em vez de se perder.
      if (!found) {
        focusOpenView();
      }
    });
  }

  return { rootRef, focusMarked, focusMarkedLater, focusLaneLater };
}

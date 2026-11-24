import { useEffect, useEffectEvent } from 'react';

/** Campo onde a tecla é do próprio campo: o Ctrl+Z desfaz o texto e a barra entra como caractere. */
function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export interface BoardShortcutHandlers {
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onFocusSearch: () => void;
}

/**
 * Atalhos do quadro: Ctrl/Cmd+Z desfaz, Ctrl/Cmd+Shift+Z e Ctrl+Y refazem e `/` vai para a busca. Ficam de fora os
 * campos de texto e as janelas abertas.
 */
export function useBoardShortcuts(handlers: BoardShortcutHandlers): void {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const { target } = event;
    if (
      event.defaultPrevented ||
      isEditable(target) ||
      (target instanceof Element && target.closest('.modal'))
    ) {
      return;
    }
    const withModifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (withModifier && (key === 'z' || key === 'y')) {
      event.preventDefault();
      if (key === 'y' || event.shiftKey) {
        handlers.onRedo();
      } else {
        handlers.onUndo();
      }
      return;
    }
    if (!withModifier && !event.altKey && event.key === '/') {
      event.preventDefault();
      handlers.onFocusSearch();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
}

import { type RefObject, useEffect, useEffectEvent } from 'react';

import {
  type EditorShortcut,
  isEditableTarget,
  shortcutFor,
} from './shortcuts';

export interface ShortcutCommands {
  readonly undo: () => void;
  readonly redo: () => void;
  readonly duplicateSelected: () => void;
  readonly deleteSelected: () => void;
}

export interface UseEditorShortcutsParams {
  readonly canvasRef: RefObject<HTMLDivElement | null>;
  readonly commands: ShortcutCommands;
}

interface FocusInCanvasParams {
  readonly target: EventTarget | null;
  readonly canvas: HTMLDivElement | null;
}

function isFocusInCanvas({ target, canvas }: Readonly<FocusInCanvasParams>) {
  if (target === document.body) {
    return true;
  }
  if (!(target instanceof Node) || canvas === null) {
    return false;
  }
  return canvas.contains(target);
}

interface CommandForParams {
  readonly shortcut: EditorShortcut;
  readonly commands: ShortcutCommands;
}

function commandFor({
  shortcut,
  commands,
}: Readonly<CommandForParams>): () => void {
  switch (shortcut) {
    case 'undo':
      return commands.undo;
    case 'redo':
      return commands.redo;
    case 'duplicate':
      return commands.duplicateSelected;
    case 'delete':
      return commands.deleteSelected;
  }
}

/** Atalhos de teclado do editor, ouvidos no documento inteiro. */
export function useEditorShortcuts({
  canvasRef,
  commands,
}: Readonly<UseEditorShortcutsParams>) {
  const runShortcut = useEffectEvent((event: KeyboardEvent) => {
    const shortcut = shortcutFor(event);
    if (!shortcut || isEditableTarget(event.target)) {
      return;
    }
    // NOTE: Delete e Backspace só apagam a seleção com o foco no canvas ou em lugar nenhum, para não surpreender
    // quem está num botão da barra ou do painel.
    const inCanvas = isFocusInCanvas({
      target: event.target,
      canvas: canvasRef.current,
    });
    if (shortcut === 'delete' && !inCanvas) {
      return;
    }
    event.preventDefault();
    const command = commandFor({ shortcut, commands });
    command();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => runShortcut(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
}

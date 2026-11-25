export type EditorShortcut =
  | 'undo'
  | 'redo'
  | 'duplicate'
  | 'copy'
  | 'paste'
  | 'delete';

interface KeyPress {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

/** Atalho do editor para a tecla, com Ctrl no Windows e Linux ou Cmd no macOS. */
export function shortcutFor(press: KeyPress): EditorShortcut | null {
  const key = press.key.toLowerCase();
  if (key === 'delete' || key === 'backspace') {
    return 'delete';
  }
  if (!press.ctrlKey && !press.metaKey) {
    return null;
  }
  if (key === 'z') {
    return press.shiftKey ? 'redo' : 'undo';
  }
  if (key === 'y') {
    return 'redo';
  }
  if (key === 'd') {
    return 'duplicate';
  }
  if (key === 'c') {
    return 'copy';
  }
  if (key === 'v') {
    return 'paste';
  }
  return null;
}

/** Campo de texto ou área editável: ali as teclas pertencem ao texto, não ao editor. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.matches('input, textarea, select, [contenteditable="true"]')
  );
}

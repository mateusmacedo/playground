import { ariaLabels } from './aria-labels';
import { isEditableTarget, shortcutFor } from './shortcuts';

function press(
  key: string,
  modifiers: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }>,
) {
  return shortcutFor({
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  });
}

describe('shortcutFor', () => {
  it('reconhece desfazer e refazer com Ctrl ou Cmd', () => {
    expect(press('z', { ctrlKey: true })).toBe('undo');
    expect(press('Z', { metaKey: true, shiftKey: true })).toBe('redo');
    expect(press('y', { ctrlKey: true })).toBe('redo');
  });

  it('reconhece duplicar e excluir', () => {
    expect(press('d', { ctrlKey: true })).toBe('duplicate');
    expect(press('Delete', {})).toBe('delete');
    expect(press('Backspace', {})).toBe('delete');
  });

  it('ignora letra sem modificador e combinação sem atalho', () => {
    expect(press('z', {})).toBeNull();
    expect(press('k', { ctrlKey: true })).toBeNull();
  });
});

describe('isEditableTarget', () => {
  it('reconhece campo de texto e área editável', () => {
    const input = document.createElement('input');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');

    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('ariaLabels', () => {
  it('anuncia o movimento por teclado em PT-BR', () => {
    const message = ariaLabels['node.a11yDescription.ariaLiveMessage'];

    expect(message?.({ direction: 'up', x: 10, y: 20 })).toBe(
      'Bloco movido para cima. Nova posição: x 10, y 20.',
    );
    expect(message?.({ direction: 'diagonal', x: 0, y: 0 })).toBe(
      'Bloco movido diagonal. Nova posição: x 0, y 0.',
    );
  });
});

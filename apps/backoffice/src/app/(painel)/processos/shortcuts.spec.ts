import { ariaLabels } from './aria-labels';
import { isEditableTarget, shortcutFor } from './shortcuts';

interface PressParams {
  readonly key: string;
  readonly modifiers: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }>;
}

function press({ key, modifiers }: Readonly<PressParams>) {
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
    expect(press({ key: 'z', modifiers: { ctrlKey: true } })).toBe('undo');
    expect(
      press({ key: 'Z', modifiers: { metaKey: true, shiftKey: true } }),
    ).toBe('redo');
    expect(press({ key: 'y', modifiers: { ctrlKey: true } })).toBe('redo');
  });

  it('reconhece duplicar e excluir', () => {
    expect(press({ key: 'd', modifiers: { ctrlKey: true } })).toBe('duplicate');
    expect(press({ key: 'Delete', modifiers: {} })).toBe('delete');
    expect(press({ key: 'Backspace', modifiers: {} })).toBe('delete');
  });

  it('reconhece copiar e colar com Ctrl ou Cmd', () => {
    expect(press({ key: 'c', modifiers: { ctrlKey: true } })).toBe('copy');
    expect(press({ key: 'v', modifiers: { metaKey: true } })).toBe('paste');
  });

  it('ignora letra sem modificador e combinação sem atalho', () => {
    expect(press({ key: 'z', modifiers: {} })).toBeNull();
    expect(press({ key: 'c', modifiers: {} })).toBeNull();
    expect(press({ key: 'k', modifiers: { ctrlKey: true } })).toBeNull();
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

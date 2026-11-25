import { fireEvent, render, screen } from '@testing-library/react';

import { EditorToolbar, type EditorToolbarProps } from './editor-toolbar';

function renderToolbar(props: Partial<EditorToolbarProps> = {}) {
  const handlers = {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onFitView: vi.fn(),
    onClear: vi.fn(),
  };
  render(
    <EditorToolbar
      canUndo
      canRedo
      hasSelection
      isEmpty={false}
      issueCount={0}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

function button(name: string) {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

describe('EditorToolbar', () => {
  it('chama cada ação pelo botão', () => {
    const handlers = renderToolbar();

    for (const name of [
      'Desfazer',
      'Refazer',
      'Duplicar',
      'Excluir',
      'Ajustar à tela',
      'Limpar',
    ]) {
      fireEvent.click(button(name));
    }

    expect(handlers.onUndo).toHaveBeenCalled();
    expect(handlers.onRedo).toHaveBeenCalled();
    expect(handlers.onDuplicate).toHaveBeenCalled();
    expect(handlers.onDelete).toHaveBeenCalled();
    expect(handlers.onFitView).toHaveBeenCalled();
    expect(handlers.onClear).toHaveBeenCalled();
    expect(button('Desfazer').getAttribute('aria-keyshortcuts')).toBe(
      'Control+Z Meta+Z',
    );
  });

  it('desliga o que não se aplica ao estado atual', () => {
    renderToolbar({
      canUndo: false,
      canRedo: false,
      hasSelection: false,
      isEmpty: true,
    });

    for (const name of [
      'Desfazer',
      'Refazer',
      'Duplicar',
      'Excluir',
      'Ajustar à tela',
      'Limpar',
    ]) {
      expect(button(name).disabled).toBe(true);
    }
  });

  it('resume a validação do processo', () => {
    renderToolbar({ issueCount: 0 });
    expect(screen.getByRole('status').textContent).toBe('Sem problemas');
  });

  it('conta os problemas no singular e no plural', () => {
    renderToolbar({ issueCount: 1 });
    expect(screen.getByRole('status').textContent).toBe('1 problema');
  });

  it('conta vários problemas', () => {
    renderToolbar({ issueCount: 3 });
    expect(screen.getByRole('status').textContent).toBe('3 problemas');
  });
});

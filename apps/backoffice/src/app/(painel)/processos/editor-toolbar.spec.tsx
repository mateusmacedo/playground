import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { EditorToolbar, type EditorToolbarProps } from './editor-toolbar';

function renderToolbar(props: Partial<EditorToolbarProps> = {}) {
  const handlers = {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onFitView: vi.fn(),
    onClear: vi.fn(),
    onAlign: vi.fn(),
    onDistribute: vi.fn(),
    onAutoLayout: vi.fn(),
  };
  render(
    <EditorToolbar
      canUndo
      canRedo
      hasSelection
      isEmpty={false}
      selectedNodes={0}
      issueCount={{ errors: 0, warnings: 0 }}
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
    const handlers = renderToolbar({ selectedNodes: 1 });

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
    renderToolbar({ issueCount: { errors: 0, warnings: 0 } });
    expect(screen.getByRole('status').textContent).toBe('Sem problemas');
  });

  it('conta os problemas no singular e no plural', () => {
    renderToolbar({ issueCount: { errors: 0, warnings: 1 } });
    expect(screen.getByRole('status').textContent).toBe('1 problema: 1 aviso');
  });

  it('lê o detalhe de erros e avisos no próprio selo', () => {
    renderToolbar({ issueCount: { errors: 2, warnings: 1 } });
    const badge = screen.getByRole('status');
    expect(badge.textContent).toBe('3 problemas: 2 erros e 1 aviso');
    expect(badge.getAttribute('title')).toBe('2 erros e 1 aviso');
  });

  it('cita só a severidade que existe', () => {
    renderToolbar({ issueCount: { errors: 1, warnings: 0 } });
    expect(screen.getByRole('status').textContent).toBe('1 problema: 1 erro');
  });

  it('conta vários avisos sem erro', () => {
    renderToolbar({ issueCount: { errors: 0, warnings: 3 } });
    expect(screen.getByRole('status').textContent).toBe(
      '3 problemas: 3 avisos',
    );
  });

  it('marca cada severidade com um ícone, além da cor', () => {
    renderToolbar({ issueCount: { errors: 1, warnings: 0 } });
    const errorIcon = screen
      .getByRole('status')
      .querySelector('svg')?.innerHTML;
    cleanup();
    renderToolbar({ issueCount: { errors: 0, warnings: 1 } });
    const warningIcon = screen
      .getByRole('status')
      .querySelector('svg')?.innerHTML;

    expect(errorIcon).toBeTruthy();
    expect(warningIcon).toBeTruthy();
    expect(errorIcon).not.toBe(warningIcon);
  });

  it('só deixa duplicar com bloco selecionado e excluir também com conexão', () => {
    renderToolbar({ hasSelection: true, selectedNodes: 0 });

    expect(button('Duplicar').disabled).toBe(true);
    expect(button('Excluir').disabled).toBe(false);
  });

  it('organiza a seleção e aplica o layout automático', () => {
    const handlers = renderToolbar({ selectedNodes: 3 });

    fireEvent.click(screen.getByRole('button', { name: 'Layout automático' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alinhar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alinhar à esquerda' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alinhar' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Distribuir na vertical' }),
    );

    expect(handlers.onAutoLayout).toHaveBeenCalledTimes(1);
    expect(handlers.onAlign).toHaveBeenCalledWith('left');
    expect(handlers.onDistribute).toHaveBeenCalledWith('vertical');
  });

  it('só deixa alinhar com dois blocos selecionados', () => {
    renderToolbar({ selectedNodes: 1 });

    expect(button('Alinhar').disabled).toBe(true);
  });
});

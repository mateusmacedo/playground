import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';

import { EditorDialogs, useEditorDialogs } from './editor-dialogs';
import type { ProcessEditorState } from './use-process-editor';

function editorMock() {
  return {
    insertOnEdge: vi.fn(),
    addConnectedBlock: vi.fn(),
    clear: vi.fn(),
  };
}

function renderDialogs() {
  const editor = editorMock();
  const { result } = renderHook(() => useEditorDialogs());
  const view = render(
    <EditorDialogs
      editor={editor as unknown as ProcessEditorState}
      dialogs={result.current}
    />,
  );
  function refresh() {
    view.rerender(
      <EditorDialogs
        editor={editor as unknown as ProcessEditorState}
        dialogs={result.current}
      />,
    );
  }
  return { editor, result, refresh };
}

describe('EditorDialogs', () => {
  it('insere o tipo escolhido na conexão pedida', async () => {
    const { editor, result, refresh } = renderDialogs();

    act(() => result.current.requestPick({ purpose: 'edge', edgeId: 'e1' }));
    refresh();
    const picker = await screen.findByRole('dialog', {
      name: 'Inserir bloco na conexão',
    });
    fireEvent.click(
      within(picker).getByRole('button', { name: /^Temporizador/ }),
    );

    expect(editor.insertOnEdge).toHaveBeenCalledWith({
      edgeId: 'e1',
      kind: 'timer',
    });
  });

  it('cria o bloco ligado à saída no ponto pedido', async () => {
    const { editor, result, refresh } = renderDialogs();

    act(() =>
      result.current.requestPick({
        purpose: 'output',
        source: 'a',
        sourceHandle: 'out',
        position: { x: 10, y: 20 },
      }),
    );
    refresh();
    const picker = await screen.findByRole('dialog', {
      name: 'Criar bloco ligado à saída',
    });
    fireEvent.click(within(picker).getByRole('button', { name: /^Fim/ }));

    expect(editor.addConnectedBlock).toHaveBeenCalledWith({
      source: 'a',
      sourceHandle: 'out',
      kind: 'end',
      position: { x: 10, y: 20 },
    });
  });

  it('limpa só depois da confirmação', async () => {
    const { editor, result, refresh } = renderDialogs();

    act(() => result.current.askClear());
    refresh();
    const confirm = await screen.findByRole('dialog', {
      name: 'Limpar o canvas',
    });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Limpar' }));

    expect(editor.clear).toHaveBeenCalledTimes(1);
  });
});

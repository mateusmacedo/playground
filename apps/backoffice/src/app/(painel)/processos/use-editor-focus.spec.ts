import { renderHook } from '@testing-library/react';

import { block, link } from './model/test-graph';
import { toProcessGraph } from './process-graph';
import { useEditorFocus } from './use-editor-focus';

const fitView = vi.fn(() => Promise.resolve(true));

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useReactFlow: () => ({ fitView }),
}));

const graph = toProcessGraph({
  nodes: [block({ id: 'a', type: 'task' }), block({ id: 'b', type: 'end' })],
  edges: [link({ source: 'a', target: 'b' })],
});

describe('useEditorFocus', () => {
  beforeEach(() => fitView.mockClear());

  it('seleciona e enquadra o bloco do problema', () => {
    const selectOnly = vi.fn();
    const { result } = renderHook(() => useEditorFocus({ graph, selectOnly }));

    result.current.focusIssue({
      key: 'k',
      severity: 'error',
      message: 'm',
      nodeId: 'a',
    });

    expect(selectOnly).toHaveBeenCalledWith({ nodeIds: ['a'] });
    expect(fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: 'a' }] }),
    );
  });

  it('seleciona a conexão do problema e enquadra as duas pontas', () => {
    const selectOnly = vi.fn();
    const { result } = renderHook(() => useEditorFocus({ graph, selectOnly }));

    result.current.focusIssue({
      key: 'k',
      severity: 'error',
      message: 'm',
      edgeId: 'a-out-b',
    });

    expect(selectOnly).toHaveBeenCalledWith({ edgeIds: ['a-out-b'] });
    expect(fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: 'a' }, { id: 'b' }] }),
    );
  });

  it('não faz nada com problema do processo inteiro', () => {
    const selectOnly = vi.fn();
    const { result } = renderHook(() => useEditorFocus({ graph, selectOnly }));

    result.current.focusIssue({ key: 'k', severity: 'error', message: 'm' });

    expect(selectOnly).not.toHaveBeenCalled();
  });
});

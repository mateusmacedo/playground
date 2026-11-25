import { act, renderHook } from '@testing-library/react';
import { EdgeChangeset, NodeChangeset } from '@xyflow/react';

import type { Graph } from './model/blocks';
import { sampleProcess } from './model/sample-process';
import type { ProcessEdge, ProcessNode } from './process-graph';
import { useProcessEditor } from './use-process-editor';

function sequentialIds() {
  let next = 0;
  return () => {
    next += 1;
    return `new-${next}`;
  };
}

function setup(initial: Graph = sampleProcess) {
  const createId = sequentialIds();
  return renderHook(() => useProcessEditor({ initial, createId }));
}

type Editor = ReturnType<typeof setup>['result'];

function nodeIds(result: Editor): string[] {
  return result.current.graph.nodes.map((node) => node.id);
}

function selectNode(result: Editor, id: string) {
  act(() =>
    result.current.onNodesChange(
      new NodeChangeset<ProcessNode>([{ id, type: 'select', selected: true }]),
    ),
  );
}

function moveNode(
  result: Editor,
  id: string,
  position: { x: number; y: number },
  dragging?: boolean,
) {
  act(() =>
    result.current.onNodesChange(
      new NodeChangeset<ProcessNode>([
        { id, type: 'position', position, dragging },
      ]),
    ),
  );
}

describe('useProcessEditor', () => {
  it('começa com o processo inicial, sem problemas e sem histórico', () => {
    const { result } = setup();

    expect(nodeIds(result)).toEqual(['start', 'task-1', 'end']);
    expect(result.current.issues).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('insere bloco selecionado, desfaz e refaz', () => {
    const { result } = setup();
    selectNode(result, 'start');

    act(() =>
      result.current.addBlock({ kind: 'decision', position: { x: 10, y: 20 } }),
    );

    const added = result.current.graph.nodes.at(-1);
    expect(added).toMatchObject({
      id: 'new-3',
      type: 'decision',
      selected: true,
    });
    expect(result.current.graph.nodes[0]?.selected).toBe(false);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(nodeIds(result)).toEqual(['start', 'task-1', 'end']);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(nodeIds(result)).toContain('new-3');
  });

  it('cria só a conexão que as regras aceitam', () => {
    const { result } = setup();
    act(() =>
      result.current.addBlock({ kind: 'task', position: { x: 0, y: 0 } }),
    );

    act(() =>
      result.current.onConnect({
        source: 'start',
        target: 'new-1',
        sourceHandle: 'out',
        targetHandle: 'in',
      }),
    );
    expect(result.current.graph.edges).toHaveLength(2);

    act(() =>
      result.current.onConnect({
        source: 'new-1',
        target: 'end',
        sourceHandle: 'out',
        targetHandle: 'in',
      }),
    );
    expect(result.current.graph.edges.at(-1)).toMatchObject({
      id: 'new-2',
      source: 'new-1',
      target: 'end',
    });
  });

  it('valida a conexão em andamento, ignorando a que está sendo reconectada', () => {
    const { result } = setup();
    const busy = {
      source: 'start',
      target: 'end',
      sourceHandle: 'out',
      targetHandle: 'in',
    };
    const edge = result.current.graph.edges[0] as ProcessEdge;

    expect(result.current.isValidConnection(busy)).toBe(false);

    act(() => result.current.onReconnectStart(null, edge));
    expect(result.current.isValidConnection(busy)).toBe(true);

    act(() => result.current.onReconnect(edge, busy));
    expect(result.current.graph.edges[0]).toMatchObject({
      source: 'start',
      target: 'end',
    });

    act(() => result.current.onReconnectEnd());
    expect(result.current.isValidConnection(busy)).toBe(false);
  });

  it('não grava seleção nem medida como passo', () => {
    const { result } = setup();
    selectNode(result, 'task-1');
    act(() =>
      result.current.onEdgesChange(
        new EdgeChangeset<ProcessEdge>([
          { id: 'task-1-end', type: 'select', selected: true },
        ]),
      ),
    );

    expect(result.current.graph.nodes[1]?.selected).toBe(true);
    expect(result.current.graph.edges[1]?.selected).toBe(true);
    expect(result.current.canUndo).toBe(false);
  });

  it('junta os movimentos seguidos pelo teclado num passo', () => {
    const { result } = setup();
    moveNode(result, 'task-1', { x: 1, y: 0 });
    moveNode(result, 'task-1', { x: 2, y: 0 });

    act(() => result.current.undo());
    expect(result.current.graph.nodes[1]?.position).toEqual({ x: 0, y: 120 });
  });

  it('grava o arraste inteiro como um passo, e o arraste sem movimento como nenhum', () => {
    const { result } = setup();
    act(() => result.current.onDragStart());
    moveNode(result, 'task-1', { x: 50, y: 120 }, true);
    moveNode(result, 'task-1', { x: 80, y: 120 }, false);
    act(() => result.current.onDragStop());

    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.graph.nodes[1]?.position).toEqual({ x: 0, y: 120 });
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.onDragStart());
    act(() => result.current.onDragStop());
    act(() => result.current.onDragStop());
    expect(result.current.canUndo).toBe(false);
  });

  it('grava remoções vindas do React Flow', () => {
    const { result } = setup();
    act(() =>
      result.current.onEdgesChange(
        new EdgeChangeset<ProcessEdge>([{ id: 'task-1-end', type: 'remove' }]),
      ),
    );
    act(() =>
      result.current.onNodesChange(
        new NodeChangeset<ProcessNode>([{ id: 'end', type: 'remove' }]),
      ),
    );

    expect(result.current.graph.edges).toHaveLength(1);
    expect(nodeIds(result)).toEqual(['start', 'task-1']);
    act(() => result.current.undo());
    act(() => result.current.undo());
    expect(result.current.graph.edges).toHaveLength(2);
  });

  it('exclui, duplica e limpa a seleção', () => {
    const { result } = setup();
    selectNode(result, 'task-1');

    act(() => result.current.duplicateSelected());
    expect(nodeIds(result)).toEqual(['start', 'task-1', 'end', 'new-1']);

    act(() => result.current.deleteSelected());
    expect(nodeIds(result)).toEqual(['start', 'task-1', 'end']);

    act(() => result.current.clear());
    expect(result.current.graph).toEqual({ nodes: [], edges: [] });
    expect(result.current.issues.map((issue) => issue.key)).toEqual([
      'missing-start',
    ]);

    const before = result.current.graph;
    act(() => result.current.clear());
    expect(result.current.graph).toBe(before);
  });

  it('junta a digitação seguida no mesmo campo num passo', () => {
    const { result } = setup();
    act(() =>
      result.current.updateBlock({ nodeId: 'task-1', patch: { label: 'R' } }),
    );
    act(() =>
      result.current.updateBlock({
        nodeId: 'task-1',
        patch: { label: 'Revisar' },
      }),
    );
    act(() =>
      result.current.updateBlock({
        nodeId: 'task-1',
        patch: { description: 'Ok' },
      }),
    );

    act(() => result.current.undo());
    expect(result.current.graph.nodes[1]?.data.label).toBe('Revisar');
    act(() => result.current.undo());
    expect(result.current.graph.nodes[1]?.data.label).toBe('Primeira etapa');
  });

  it('edita os ramos da Decisão e o rótulo da conexão', () => {
    const { result } = setup();
    act(() =>
      result.current.addBlock({ kind: 'decision', position: { x: 0, y: 0 } }),
    );
    const decisionId = 'new-3';

    act(() => result.current.addBranch(decisionId));
    act(() =>
      result.current.renameBranch({
        nodeId: decisionId,
        branchId: 'new-4',
        label: 'Talvez',
      }),
    );
    act(() =>
      result.current.removeBranch({ nodeId: decisionId, branchId: 'new-1' }),
    );
    act(() =>
      result.current.updateEdgeLabel({ edgeId: 'task-1-end', label: 'pronto' }),
    );

    const decision = result.current.graph.nodes.at(-1);
    expect(decision?.data.branches).toEqual([
      { id: 'new-2', label: 'Não' },
      { id: 'new-4', label: 'Talvez' },
    ]);
    expect(result.current.graph.edges[1]?.data).toEqual({ label: 'pronto' });
  });
});

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

interface SelectNodeParams {
  readonly result: Editor;
  readonly id: string;
}

function selectNode({ result, id }: Readonly<SelectNodeParams>) {
  act(() =>
    result.current.onNodesChange(
      new NodeChangeset<ProcessNode>([{ id, type: 'select', selected: true }]),
    ),
  );
}

interface MoveNodeParams {
  readonly result: Editor;
  readonly id: string;
  readonly position: { x: number; y: number };
  readonly dragging?: boolean;
}

function moveNode({
  result,
  id,
  position,
  dragging,
}: Readonly<MoveNodeParams>) {
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
    selectNode({ result, id: 'start' });

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
    selectNode({ result, id: 'task-1' });
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
    moveNode({ result, id: 'task-1', position: { x: 1, y: 0 } });
    moveNode({ result, id: 'task-1', position: { x: 2, y: 0 } });

    act(() => result.current.undo());
    expect(result.current.graph.nodes[1]?.position).toEqual({ x: 0, y: 120 });
  });

  it('grava o arraste inteiro como um passo, e o arraste sem movimento como nenhum', () => {
    const { result } = setup();
    act(() => result.current.onDragStart());
    moveNode({
      result,
      id: 'task-1',
      position: { x: 50, y: 120 },
      dragging: true,
    });
    moveNode({
      result,
      id: 'task-1',
      position: { x: 80, y: 120 },
      dragging: false,
    });
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
    selectNode({ result, id: 'task-1' });

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

describe('useProcessEditor nas operações compostas', () => {
  function undoOnce(result: Editor) {
    act(() => result.current.undo());
  }

  it('insere um bloco numa conexão e desfaz em um passo', () => {
    const { result } = setup();

    act(() =>
      result.current.insertOnEdge({ edgeId: 'task-1-end', kind: 'timer' }),
    );

    expect(result.current.graph.nodes).toHaveLength(4);
    expect(result.current.graph.edges).toHaveLength(3);
    undoOnce(result);
    expect(result.current.graph.nodes).toHaveLength(3);
    expect(result.current.graph.edges.map((edge) => edge.target)).toEqual([
      'task-1',
      'end',
    ]);
  });

  it('cria um bloco já ligado à saída e desfaz em um passo', () => {
    const initial: Graph = {
      nodes: sampleProcess.nodes,
      edges: sampleProcess.edges.filter((edge) => edge.id !== 'task-1-end'),
    };
    const { result } = setup(initial);

    act(() =>
      result.current.addConnectedBlock({
        source: 'task-1',
        sourceHandle: 'out',
        kind: 'end',
        position: { x: 0, y: 400 },
      }),
    );

    expect(result.current.graph.edges.at(-1)).toMatchObject({
      source: 'task-1',
    });
    undoOnce(result);
    expect(result.current.graph.edges).toHaveLength(1);
    expect(result.current.graph.nodes).toHaveLength(3);
  });

  it('converte a Etapa e desfaz em um passo', () => {
    const { result } = setup();

    act(() => result.current.convert({ nodeId: 'task-1', to: 'human-task' }));
    expect(result.current.graph.nodes[1]?.type).toBe('human-task');
    undoOnce(result);
    expect(result.current.graph.nodes[1]?.type).toBe('task');
  });

  it('cria raia, move a tarefa para ela e desfaz cada passo', () => {
    const { result } = setup();

    act(() => result.current.addLane());
    const laneId = result.current.lanes[0]?.id ?? '';
    act(() => result.current.moveToLane({ nodeId: 'task-1', laneId }));

    expect(result.current.graph.nodes[1]?.data.laneId).toBe(laneId);
    undoOnce(result);
    expect(result.current.graph.nodes[1]?.data.laneId).toBeUndefined();
    expect(result.current.lanes).toHaveLength(1);
  });

  it('copia e cola a seleção com ids novos e desfaz a colagem', () => {
    const { result } = setup();
    selectNode({ result, id: 'task-1' });

    act(() => result.current.copySelected());
    act(() => result.current.paste());

    expect(nodeIds(result)).toEqual(['start', 'task-1', 'end', 'new-1']);
    undoOnce(result);
    expect(nodeIds(result)).toEqual(['start', 'task-1', 'end']);
  });

  it('organiza automaticamente e desfaz em um passo', () => {
    const { result } = setup();
    const before = result.current.graph.nodes.map((node) => node.position);

    act(() => result.current.autoLayout());
    expect(result.current.graph.nodes.map((node) => node.position)).not.toEqual(
      before,
    );
    undoOnce(result);
    expect(result.current.graph.nodes.map((node) => node.position)).toEqual(
      before,
    );
  });

  it('limpa o canvas e recupera tudo com desfazer', () => {
    const { result } = setup();

    act(() => result.current.clear());
    expect(result.current.graph.nodes).toEqual([]);
    undoOnce(result);
    expect(nodeIds(result)).toEqual(['start', 'task-1', 'end']);
  });
});

describe('useProcessEditor nos subprocessos', () => {
  it('abre o subprocesso, edita o canvas interno e volta pela trilha', () => {
    const { result } = setup();
    act(() =>
      result.current.addBlock({ kind: 'subprocess', position: { x: 0, y: 0 } }),
    );
    const subprocessId = result.current.graph.nodes.at(-1)?.id ?? '';

    act(() => result.current.openSubprocess(subprocessId));
    expect(result.current.crumbs).toEqual([
      { nodeId: subprocessId, name: 'Subprocesso' },
    ]);
    expect(result.current.graph.nodes.map((node) => node.type)).toEqual([
      'start',
      'end',
    ]);

    act(() =>
      result.current.addBlock({ kind: 'task', position: { x: 0, y: 80 } }),
    );
    expect(result.current.graph.nodes).toHaveLength(3);

    act(() => result.current.openLevel(0));
    expect(result.current.path).toEqual([]);
    const subprocess = result.current.graph.nodes.find(
      (node) => node.id === subprocessId,
    );
    expect(subprocess?.data.process?.nodes).toHaveLength(3);
  });

  it('volta ao processo principal quando o subprocesso aberto é desfeito', () => {
    const { result } = setup();
    act(() =>
      result.current.addBlock({ kind: 'subprocess', position: { x: 0, y: 0 } }),
    );
    const subprocessId = result.current.graph.nodes.at(-1)?.id ?? '';
    act(() => result.current.openSubprocess(subprocessId));

    act(() => result.current.undo());

    expect(result.current.path).toEqual([]);
    expect(nodeIds(result)).toEqual(['start', 'task-1', 'end']);
  });
});

describe('useProcessEditor nos comandos de estrutura', () => {
  it('prende exceção, alinha, distribui e mexe nas raias, cada um num passo', () => {
    const { result } = setup();
    act(() =>
      result.current.addBlock({
        kind: 'automated-task',
        position: { x: 300, y: 0 },
      }),
    );
    const taskId = result.current.graph.nodes.at(-1)?.id ?? '';

    act(() => result.current.addException(taskId));
    expect(result.current.graph.nodes.at(-1)?.parentId).toBe(taskId);

    for (const id of ['start', 'task-1', 'end']) {
      selectNode({ result, id });
    }
    act(() =>
      result.current.selectOnly({ nodeIds: ['start', 'task-1', 'end'] }),
    );
    act(() => result.current.align('left'));
    const lefts = result.current.graph.nodes
      .filter((node) => ['start', 'task-1', 'end'].includes(node.id))
      .map((node) => node.position.x);
    expect(new Set(lefts).size).toBe(1);
    act(() => result.current.distribute('vertical'));

    act(() => result.current.addLane());
    act(() => result.current.addLane());
    const [first] = result.current.lanes;
    act(() =>
      result.current.renameLane({ laneId: first?.id ?? '', name: 'Vendas' }),
    );
    act(() =>
      result.current.moveLane({ laneId: first?.id ?? '', direction: 'after' }),
    );
    expect(result.current.lanes.map((lane) => lane.name)).toEqual([
      'Raia 2',
      'Vendas',
    ]);
  });

  it('acusa nome de raia repetido entre os problemas', () => {
    const { result } = setup();
    act(() => result.current.addLane());
    act(() => result.current.addLane());
    const [first, second] = result.current.lanes;

    act(() =>
      result.current.renameLane({
        laneId: second?.id ?? '',
        name: first?.name ?? '',
      }),
    );

    expect(result.current.issues.map((issue) => issue.key)).toContain(
      `duplicate-lane:${second?.id}`,
    );
  });
});

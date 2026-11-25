import type { Graph, GraphNode } from './blocks';
import { copySelection, duplicateSelection, pasteClip } from './clipboard';
import { DUPLICATE_OFFSET } from './editing';
import { block, decisionBranches, link, sequentialIds } from './test-graph';

const graph: Graph = {
  nodes: [
    block({ id: 'start', type: 'start' }),
    block({
      id: 'decision',
      type: 'decision',
      data: { branches: decisionBranches, defaultBranchId: 'no' },
    }),
    block({ id: 'task', type: 'task' }),
    block({ id: 'end', type: 'end' }),
  ],
  edges: [
    link({ source: 'start', target: 'decision' }),
    link({ source: 'decision', target: 'task', sourceHandle: 'yes' }),
    link({ source: 'decision', target: 'end', sourceHandle: 'no' }),
    link({ source: 'task', target: 'end' }),
  ],
};

function selectNodes(source: Graph, ids: readonly string[]): Graph {
  return {
    nodes: source.nodes.map((node) => ({
      ...node,
      selected: ids.includes(node.id),
    })),
    edges: source.edges,
  };
}

function findNode(source: Graph, id: string): GraphNode | undefined {
  return source.nodes.find((node) => node.id === id);
}

describe('copySelection', () => {
  it('leva os blocos selecionados e só as conexões entre eles', () => {
    const clip = copySelection(selectNodes(graph, ['decision', 'task']));

    expect(clip?.nodes.map((node) => node.id)).toEqual(['decision', 'task']);
    expect(clip?.edges.map((edge) => edge.id)).toEqual(['decision-yes-task']);
  });

  it('leva junto a exceção presa a uma tarefa selecionada', () => {
    const withException: Graph = {
      nodes: [
        block({ id: 'work', type: 'automated-task' }),
        { ...block({ id: 'failure', type: 'exception' }), parentId: 'work' },
      ],
      edges: [],
    };

    const clip = copySelection(selectNodes(withException, ['work']));

    expect(clip?.nodes.map((node) => node.id)).toEqual(['work', 'failure']);
  });

  it('devolve null sem bloco selecionado', () => {
    expect(copySelection(graph)).toBeNull();
  });
});

describe('pasteClip', () => {
  it('gera ids novos para blocos, ramos e conexões e remapeia o ramo padrão', () => {
    const clip = copySelection(selectNodes(graph, ['decision', 'task']));
    if (clip === null) {
      throw new Error('trecho vazio');
    }

    const result = pasteClip({ graph, clip, createId: sequentialIds() });
    const decisionCopy = findNode(result, 'copy-1');

    expect(decisionCopy?.data.branches).toEqual([
      { id: 'copy-3', label: 'Sim' },
      { id: 'copy-4', label: 'Não' },
    ]);
    expect(decisionCopy?.data.defaultBranchId).toBe('copy-4');
    expect(decisionCopy?.position).toEqual(DUPLICATE_OFFSET);
    expect(result.edges.at(-1)).toMatchObject({
      id: 'copy-5',
      source: 'copy-1',
      target: 'copy-2',
      sourceHandle: 'copy-3',
    });
  });

  it('seleciona só as cópias', () => {
    const clip = copySelection(selectNodes(graph, ['task']));
    if (clip === null) {
      throw new Error('trecho vazio');
    }

    const result = pasteClip({ graph, clip, createId: sequentialIds() });
    const selected = result.nodes.filter((node) => node.selected);

    expect(selected.map((node) => node.id)).toEqual(['copy-1']);
  });

  it('remapeia o par de abertura e sincronização copiados juntos', () => {
    const parallel: Graph = {
      nodes: [
        block({
          id: 'split',
          type: 'parallel-split',
          data: { branches: decisionBranches },
        }),
        block({ id: 'join', type: 'parallel-join', data: { pairId: 'split' } }),
        block({ id: 'other', type: 'parallel-join', data: { pairId: 'far' } }),
      ],
      edges: [],
    };

    const clip = copySelection(
      selectNodes(parallel, ['split', 'join', 'other']),
    );
    if (clip === null) {
      throw new Error('trecho vazio');
    }
    const result = pasteClip({
      graph: parallel,
      clip,
      createId: sequentialIds(),
    });

    expect(findNode(result, 'copy-2')?.data.pairId).toBe('copy-1');
    expect(findNode(result, 'copy-3')?.data.pairId).toBe('far');
  });

  it('mantém a exceção presa à tarefa copiada, na mesma posição relativa', () => {
    const withException: Graph = {
      nodes: [
        block({ id: 'work', type: 'automated-task' }),
        {
          ...block({ id: 'failure', type: 'exception' }),
          parentId: 'work',
          position: { x: 16, y: 48 },
        },
      ],
      edges: [],
    };
    const clip = copySelection(selectNodes(withException, ['work']));
    if (clip === null) {
      throw new Error('trecho vazio');
    }

    const result = pasteClip({
      graph: withException,
      clip,
      createId: sequentialIds(),
    });
    const exceptionCopy = findNode(result, 'copy-2');

    expect(exceptionCopy?.parentId).toBe('copy-1');
    expect(exceptionCopy?.position).toEqual({ x: 16, y: 48 });
  });

  it('copia o canvas interno do subprocesso com ids novos', () => {
    const inner: Graph = {
      nodes: [
        block({ id: 'inner-start', type: 'start' }),
        block({ id: 'inner-end', type: 'end' }),
      ],
      edges: [link({ source: 'inner-start', target: 'inner-end' })],
    };
    const withSubprocess: Graph = {
      nodes: [
        block({ id: 'sub', type: 'subprocess', data: { process: inner } }),
      ],
      edges: [],
    };
    const clip = copySelection(selectNodes(withSubprocess, ['sub']));
    if (clip === null) {
      throw new Error('trecho vazio');
    }

    const result = pasteClip({
      graph: withSubprocess,
      clip,
      createId: sequentialIds(),
    });
    const process = findNode(result, 'copy-1')?.data.process;

    expect(process?.nodes.map((node) => node.id)).toEqual(['copy-2', 'copy-3']);
    expect(process?.edges[0]).toMatchObject({
      id: 'copy-4',
      source: 'copy-2',
      target: 'copy-3',
    });
    expect(findNode(withSubprocess, 'sub')?.data.process).toBe(inner);
  });
});

describe('duplicateSelection', () => {
  it('copia e cola a seleção num passo, com as cópias selecionadas', () => {
    const result = duplicateSelection({
      graph: selectNodes(graph, ['decision', 'task']),
      createId: sequentialIds(),
    });

    expect(result.nodes).toHaveLength(6);
    expect(result.edges).toHaveLength(5);
    expect(
      result.nodes.filter((node) => node.selected).map((node) => node.id),
    ).toEqual(['copy-1', 'copy-2']);
  });

  it('devolve o mesmo grafo sem seleção', () => {
    expect(duplicateSelection({ graph, createId: sequentialIds() })).toBe(
      graph,
    );
  });
});

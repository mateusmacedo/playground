import type { EdgeChangeset, NodeChangeset } from '@xyflow/react';
import { useRef, useState } from 'react';

import {
  commit,
  commitSince,
  createHistory,
  redo,
  replacePresent,
  undo,
} from './model/history';
import type { ProcessEdge, ProcessGraph, ProcessNode } from './process-graph';

type GraphUpdate = (graph: ProcessGraph) => ProcessGraph;

interface PositionsChangedParams {
  readonly before: ProcessGraph;
  readonly after: ProcessGraph;
}

function positionsChanged(params: PositionsChangedParams): boolean {
  const { before, after } = params;
  return after.nodes.some((node) => {
    const previous = before.nodes.find((candidate) => candidate.id === node.id);
    return (
      previous !== undefined &&
      (previous.position.x !== node.position.x ||
        previous.position.y !== node.position.y)
    );
  });
}

export interface GraphChange {
  readonly update: GraphUpdate;
  readonly key?: string;
}

/**
 * Estado do grafo com desfazer e refazer. Ações do usuário viram passos; seleção, medidas e o meio de um arraste só
 * atualizam a tela. O arraste inteiro vira um passo quando termina, e as setas seguidas no mesmo bloco viram um só.
 */
export function useGraphHistory(createInitial: () => ProcessGraph) {
  const [history, setHistory] = useState(() => createHistory(createInitial()));
  const dragOrigin = useRef<ProcessGraph | null>(null);

  function change(params: GraphChange) {
    const { update, key } = params;
    setHistory((current) =>
      commit({ history: current, next: update(current.present), key }),
    );
  }

  function changeQuietly(update: GraphUpdate) {
    setHistory((current) =>
      replacePresent({ history: current, next: update(current.present) }),
    );
  }

  function onNodesChange(changes: NodeChangeset<ProcessNode>) {
    const update: GraphUpdate = (graph) => ({
      nodes: changes.applyTo([...graph.nodes]),
      edges: graph.edges,
    });
    const moves = changes.getByType('position');
    const dragging =
      dragOrigin.current !== null || moves.some((move) => move.dragging);
    if (changes.getByType('remove').length > 0) {
      change({ update });
    } else if (moves.length > 0 && !dragging) {
      const movedIds = moves.map((move) => move.id).join(',');
      change({ update, key: `nudge:${movedIds}` });
    } else {
      changeQuietly(update);
    }
  }

  function onEdgesChange(changes: EdgeChangeset<ProcessEdge>) {
    const update: GraphUpdate = (graph) => ({
      nodes: graph.nodes,
      edges: changes.applyTo([...graph.edges]),
    });
    if (changes.getByType('remove').length > 0) {
      change({ update });
    } else {
      changeQuietly(update);
    }
  }

  function onDragStart() {
    dragOrigin.current = history.present;
  }

  function onDragStop() {
    const before = dragOrigin.current;
    dragOrigin.current = null;
    if (!before) {
      return;
    }
    setHistory((current) =>
      positionsChanged({ before, after: current.present })
        ? commitSince({ history: current, before })
        : current,
    );
  }

  return {
    graph: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    change,
    onNodesChange,
    onEdgesChange,
    onDragStart,
    onDragStop,
    undo: () => setHistory(undo),
    redo: () => setHistory(redo),
  };
}

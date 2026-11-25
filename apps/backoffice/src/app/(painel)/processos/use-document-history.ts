import type { EdgeChangeset, NodeChangeset } from '@xyflow/react';
import { useMemo, useRef, useState } from 'react';

import {
  type EditorDocument,
  type GraphUpdate,
  levelGraph,
  updateLevel,
  validPath,
} from './editor-document';
import { syncLanesFromPosition } from './model/document';
import {
  commit,
  commitSince,
  createHistory,
  type History,
  redo,
  replacePresent,
  undo,
} from './model/history';
import { type ProcessPath, pathCrumbs } from './model/subprocess';
import type { ProcessEdge, ProcessGraph, ProcessNode } from './process-graph';

export interface GraphChange {
  readonly update: GraphUpdate;
  readonly key?: string;
}

export type DocumentUpdate = (document: EditorDocument) => EditorDocument;

export interface DocumentChange {
  readonly update: DocumentUpdate;
  readonly key?: string;
}

interface MovedNodesParams {
  readonly before: ProcessGraph;
  readonly after: ProcessGraph;
}

/** Ids dos blocos cuja posição mudou entre os dois grafos. */
function movedNodeIds(params: MovedNodesParams): string[] {
  const { before, after } = params;
  const previous = new Map(
    before.nodes.map((node) => [node.id, node.position]),
  );
  const moved: string[] = [];
  for (const node of after.nodes) {
    const position = previous.get(node.id);
    const changed =
      position !== undefined &&
      (position.x !== node.position.x || position.y !== node.position.y);
    if (changed) {
      moved.push(node.id);
    }
  }
  return moved;
}

interface FinishDragParams {
  readonly history: History<EditorDocument>;
  readonly before: EditorDocument;
  readonly path: ProcessPath;
}

/** Fecha um arraste como um passo só; no nível raiz, o bloco solto noutra raia passa a ser dela. */
function finishDrag(params: FinishDragParams): History<EditorDocument> {
  const { history, before, path } = params;
  const moved = movedNodeIds({
    before: levelGraph({ document: before, path }),
    after: levelGraph({ document: history.present, path }),
  });
  if (moved.length === 0) {
    return history;
  }
  const present =
    path.length === 0
      ? syncLanesFromPosition({ document: history.present, nodeIds: moved })
      : history.present;
  return commitSince({ history: { ...history, present }, before });
}

/**
 * Documento com desfazer e refazer, editado no nível aberto (o processo ou um subprocesso). Ações do usuário viram
 * passos; seleção, medidas e o meio de um arraste só atualizam a tela. O arraste inteiro vira um passo quando
 * termina, e as setas seguidas no mesmo bloco viram um só. Navegar entre subprocessos não entra no histórico.
 */
export function useDocumentHistory(createInitial: () => EditorDocument) {
  const [history, setHistory] = useState(() => createHistory(createInitial()));
  const [openPath, setOpenPath] = useState<ProcessPath>([]);
  const dragOrigin = useRef<EditorDocument | null>(null);
  const document = history.present;
  const path = useMemo(
    () => validPath({ document, path: openPath }),
    [document, openPath],
  );
  const graph = useMemo(() => levelGraph({ document, path }), [document, path]);
  const crumbs = useMemo(
    () => pathCrumbs({ root: document.graph, path }),
    [document, path],
  );

  function changeDocument(params: DocumentChange) {
    const { update, key } = params;
    setHistory((current) =>
      commit({ history: current, next: update(current.present), key }),
    );
  }

  function change(params: GraphChange) {
    const { update, key } = params;
    changeDocument({
      update: (current) => updateLevel({ document: current, path, update }),
      key,
    });
  }

  function changeQuietly(update: GraphUpdate) {
    setHistory((current) =>
      replacePresent({
        history: current,
        next: updateLevel({ document: current.present, path, update }),
      }),
    );
  }

  function onNodesChange(changes: NodeChangeset<ProcessNode>) {
    const update: GraphUpdate = (current) => ({
      nodes: changes.applyTo([...current.nodes]),
      edges: current.edges,
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
    const update: GraphUpdate = (current) => ({
      nodes: current.nodes,
      edges: changes.applyTo([...current.edges]),
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
    setHistory((current) => finishDrag({ history: current, before, path }));
  }

  function openSubprocess(nodeId: string) {
    setOpenPath([...path, nodeId]);
  }

  /** Volta para um nível da trilha: 0 é o processo principal. */
  function openLevel(depth: number) {
    setOpenPath(path.slice(0, depth));
  }

  return {
    document,
    graph,
    lanes: document.lanes,
    path,
    crumbs,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    change,
    changeDocument,
    onNodesChange,
    onEdgesChange,
    onDragStart,
    onDragStop,
    openSubprocess,
    openLevel,
    undo: () => setHistory(undo),
    redo: () => setHistory(redo),
  };
}

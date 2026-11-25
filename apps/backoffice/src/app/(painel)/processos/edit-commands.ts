import { createBlock } from './model/block-factory';
import type { BlockKind, Point } from './model/blocks';
import {
  type Clip,
  copySelection,
  duplicateSelection,
  pasteClip,
} from './model/clipboard';
import { suggestedPairId } from './model/composite';
import {
  addBranch,
  deleteSelection,
  removeBranch,
  renameBranch,
  unselected,
  updateBlockData,
  updateEdgeLabel,
} from './model/editing';
import type { ProcessEdge, ProcessGraph, ProcessNode } from './process-graph';
import type {
  RemoveBranchChange,
  RenameBranchChange,
  UpdateBlockChange,
  UpdateEdgeLabelChange,
} from './properties/panel-commands';
import type { GraphChange } from './use-document-history';

const EMPTY_GRAPH: ProcessGraph = { nodes: [], edges: [] };

function clearedGraph(current: ProcessGraph): ProcessGraph {
  const isEmpty = current.nodes.length === 0 && current.edges.length === 0;
  if (isEmpty) {
    return current;
  }
  return EMPTY_GRAPH;
}

export interface AddBlockParams {
  readonly kind: BlockKind;
  readonly position: Point;
}

/** Trecho copiado, guardado entre renders; colar funciona em qualquer nível do processo. */
export interface ClipboardRef {
  current: Clip<ProcessNode, ProcessEdge> | null;
}

export interface EditCommandsParams {
  readonly change: (change: GraphChange) => void;
  readonly createId: () => string;
  readonly graph: ProcessGraph;
  readonly clipboard: ClipboardRef;
}

/**
 * Comandos de edição que a barra, a biblioteca e o painel chamam. Cada um vira um passo do histórico; a `key` junta a
 * digitação seguida no mesmo campo num passo só.
 */
export function createEditCommands({
  change,
  createId,
  graph,
  clipboard,
}: Readonly<EditCommandsParams>) {
  function addBlock({ kind, position }: Readonly<AddBlockParams>) {
    const created: ProcessNode = createBlock({ kind, position, createId });
    change({
      update: (current) => {
        // NOTE: a sincronização nova já aponta para a abertura quando só existe uma sem par.
        const pairId = suggestedPairId({ graph: current, kind });
        const data =
          pairId === undefined ? created.data : { ...created.data, pairId };
        const block: ProcessNode = { ...created, data, selected: true };
        return {
          nodes: [...unselected(current.nodes), block],
          edges: unselected(current.edges),
        };
      },
    });
  }

  function updateBlock({ nodeId, patch }: Readonly<UpdateBlockChange>) {
    const fields = Object.keys(patch).join(',');
    change({
      update: (current) => updateBlockData({ graph: current, nodeId, patch }),
      key: `block:${nodeId}:${fields}`,
    });
  }

  function updateConnectionLabel({
    edgeId,
    label,
  }: Readonly<UpdateEdgeLabelChange>) {
    change({
      update: (current) => updateEdgeLabel({ graph: current, edgeId, label }),
      key: `edge:${edgeId}:label`,
    });
  }

  function deleteSelected() {
    change({ update: deleteSelection });
  }

  function duplicateSelected() {
    change({
      update: (current) => duplicateSelection({ graph: current, createId }),
    });
  }

  function clear() {
    change({ update: clearedGraph });
  }

  function copySelected() {
    const clip = copySelection(graph);
    if (clip !== null) {
      clipboard.current = clip;
    }
  }

  function paste() {
    const clip = clipboard.current;
    if (clip === null) {
      return;
    }
    change({
      update: (current) => pasteClip({ graph: current, clip, createId }),
    });
  }

  return {
    addBlock,
    updateBlock,
    updateEdgeLabel: updateConnectionLabel,
    deleteSelected,
    duplicateSelected,
    clear,
    copySelected,
    paste,
  };
}

export interface BranchCommandsParams {
  readonly change: (change: GraphChange) => void;
  readonly createId: () => string;
}

/** Ramos de decisões e aberturas: criar, renomear e remover, cada um como um passo do histórico. */
export function createBranchCommands({
  change,
  createId,
}: Readonly<BranchCommandsParams>) {
  function addDecisionBranch(nodeId: string) {
    change({
      update: (current) => addBranch({ graph: current, nodeId, createId }),
    });
  }

  function renameDecisionBranch({
    nodeId,
    branchId,
    label,
  }: Readonly<RenameBranchChange>) {
    change({
      update: (current) =>
        renameBranch({ graph: current, nodeId, branchId, label }),
      key: `branch:${nodeId}:${branchId}`,
    });
  }

  function removeDecisionBranch({
    nodeId,
    branchId,
  }: Readonly<RemoveBranchChange>) {
    change({
      update: (current) => removeBranch({ graph: current, nodeId, branchId }),
    });
  }

  return {
    addBranch: addDecisionBranch,
    renameBranch: renameDecisionBranch,
    removeBranch: removeDecisionBranch,
  };
}

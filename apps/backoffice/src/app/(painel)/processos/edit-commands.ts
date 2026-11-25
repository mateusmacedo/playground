import { type BlockKind, createBlock, type Point } from './model/blocks';
import {
  addBranch,
  deleteSelection,
  duplicateSelection,
  removeBranch,
  renameBranch,
  updateBlockData,
  updateEdgeLabel,
} from './model/editing';
import type { ProcessGraph, ProcessNode } from './process-graph';
import type {
  RemoveBranchChange,
  RenameBranchChange,
  UpdateBlockChange,
  UpdateEdgeLabelChange,
} from './properties/panel-commands';
import type { GraphChange } from './use-graph-history';

const EMPTY_GRAPH: ProcessGraph = { nodes: [], edges: [] };

interface Selectable {
  readonly selected?: boolean;
}

function unselected<T extends Selectable>(items: readonly T[]): T[] {
  const result: T[] = [];
  for (const item of items) {
    if (item.selected) {
      result.push({ ...item, selected: false });
    } else {
      result.push(item);
    }
  }
  return result;
}

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

export interface EditCommandsParams {
  readonly change: (change: GraphChange) => void;
  readonly createId: () => string;
}

/**
 * Comandos de edição que a barra, a biblioteca e o painel chamam. Cada um vira um passo do histórico; a `key` junta a
 * digitação seguida no mesmo campo num passo só.
 */
export function createEditCommands({
  change,
  createId,
}: Readonly<EditCommandsParams>) {
  function addBlock({ kind, position }: Readonly<AddBlockParams>) {
    const block: ProcessNode = {
      ...createBlock({ kind, position, createId }),
      selected: true,
    };
    change({
      update: (current) => ({
        nodes: [...unselected(current.nodes), block],
        edges: unselected(current.edges),
      }),
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

  return {
    addBlock,
    updateBlock,
    updateEdgeLabel: updateConnectionLabel,
    deleteSelected,
    duplicateSelected,
    clear,
  };
}

/** Ramos da Decisão: criar, renomear e remover, cada um como um passo do histórico. */
export function createBranchCommands({
  change,
  createId,
}: Readonly<EditCommandsParams>) {
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

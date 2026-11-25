import type { Connection } from '@xyflow/react';
import { useMemo, useRef } from 'react';

import {
  type BlockKind,
  createBlock,
  type Graph,
  type Point,
} from './model/blocks';
import { connectionProblem } from './model/connections';
import {
  addBranch,
  deleteSelection,
  duplicateSelection,
  reconnectEdge,
  removeBranch,
  renameBranch,
  updateBlockData,
  updateEdgeLabel,
} from './model/editing';
import { findIssues } from './model/validation';
import {
  type ProcessEdge,
  type ProcessGraph,
  type ProcessNode,
  toProcessGraph,
} from './process-graph';
import type {
  RemoveBranchChange,
  RenameBranchChange,
  UpdateBlockChange,
  UpdateEdgeLabelChange,
} from './properties/panel-commands';
import { useGraphHistory } from './use-graph-history';

const EMPTY_GRAPH: ProcessGraph = { nodes: [], edges: [] };

function defaultCreateId(): string {
  return crypto.randomUUID();
}

function unselected<T extends { readonly selected?: boolean }>(
  items: readonly T[],
): T[] {
  return items.map((item) =>
    item.selected ? { ...item, selected: false } : item,
  );
}

export interface UseProcessEditorParams {
  readonly initial: Graph;
  readonly createId?: () => string;
}

interface AddBlockParams {
  readonly kind: BlockKind;
  readonly position: Point;
}

/** Estado e comandos do editor: o que a barra, a biblioteca, o painel e o canvas chamam. */
export function useProcessEditor(params: UseProcessEditorParams) {
  const createId = params.createId ?? defaultCreateId;
  const history = useGraphHistory(() => toProcessGraph(params.initial));
  const reconnecting = useRef<string | null>(null);
  const { graph, change } = history;
  const issues = useMemo(() => findIssues(graph), [graph]);

  function isValidConnection(connection: Connection | ProcessEdge): boolean {
    const problem = connectionProblem({
      graph,
      connection,
      ignoreEdgeId: reconnecting.current ?? undefined,
    });
    return problem === null;
  }

  function onConnect(connection: Connection) {
    change({
      update: (current) => {
        if (connectionProblem({ graph: current, connection }) !== null) {
          return current;
        }
        const edge: ProcessEdge = { id: createId(), ...connection };
        return { nodes: current.nodes, edges: [...current.edges, edge] };
      },
    });
  }

  function addBlock(params: AddBlockParams) {
    const { kind, position } = params;
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

  function updateBlock(params: UpdateBlockChange) {
    const { nodeId, patch } = params;
    change({
      update: (current) => updateBlockData({ graph: current, nodeId, patch }),
      key: `block:${nodeId}:${Object.keys(patch).join(',')}`,
    });
  }

  function renameDecisionBranch(params: RenameBranchChange) {
    const { nodeId, branchId, label } = params;
    change({
      update: (current) =>
        renameBranch({ graph: current, nodeId, branchId, label }),
      key: `branch:${nodeId}:${branchId}`,
    });
  }

  function removeDecisionBranch(params: RemoveBranchChange) {
    const { nodeId, branchId } = params;
    change({
      update: (current) => removeBranch({ graph: current, nodeId, branchId }),
    });
  }

  function updateConnectionLabel(params: UpdateEdgeLabelChange) {
    const { edgeId, label } = params;
    change({
      update: (current) => updateEdgeLabel({ graph: current, edgeId, label }),
      key: `edge:${edgeId}:label`,
    });
  }

  return {
    ...history,
    issues,
    isValidConnection,
    onConnect,
    onReconnectStart: (_event: unknown, edge: ProcessEdge) => {
      reconnecting.current = edge.id;
    },
    onReconnect: (edge: ProcessEdge, connection: Connection) =>
      change({
        update: (current) =>
          reconnectEdge({ graph: current, edgeId: edge.id, connection }),
      }),
    onReconnectEnd: () => {
      reconnecting.current = null;
    },
    addBlock,
    deleteSelected: () => change({ update: deleteSelection }),
    duplicateSelected: () =>
      change({
        update: (current) => duplicateSelection({ graph: current, createId }),
      }),
    clear: () =>
      change({
        update: (current) =>
          current.nodes.length === 0 && current.edges.length === 0
            ? current
            : EMPTY_GRAPH,
      }),
    updateBlock,
    addBranch: (nodeId: string) =>
      change({
        update: (current) => addBranch({ graph: current, nodeId, createId }),
      }),
    renameBranch: renameDecisionBranch,
    removeBranch: removeDecisionBranch,
    updateEdgeLabel: updateConnectionLabel,
  };
}

export type ProcessEditorState = ReturnType<typeof useProcessEditor>;

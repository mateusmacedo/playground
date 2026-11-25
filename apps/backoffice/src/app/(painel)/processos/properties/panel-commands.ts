import type { BlockData } from '../model/blocks';

export interface UpdateBlockChange {
  readonly nodeId: string;
  readonly patch: Partial<BlockData>;
}

export interface RenameBranchChange {
  readonly nodeId: string;
  readonly branchId: string;
  readonly label: string;
}

export interface RemoveBranchChange {
  readonly nodeId: string;
  readonly branchId: string;
}

export interface UpdateEdgeLabelChange {
  readonly edgeId: string;
  readonly label: string;
}

/** O que o painel de propriedades pede ao editor; o estado do `useProcessEditor` já tem esse formato. */
export interface PanelCommands {
  readonly updateBlock: (change: UpdateBlockChange) => void;
  readonly addBranch: (nodeId: string) => void;
  readonly renameBranch: (change: RenameBranchChange) => void;
  readonly removeBranch: (change: RemoveBranchChange) => void;
  readonly updateEdgeLabel: (change: UpdateEdgeLabelChange) => void;
  readonly duplicateSelected: () => void;
  readonly deleteSelected: () => void;
}

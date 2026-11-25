import type { BlockData, Branch } from '../model/blocks';
import type { ProcessIssue } from '../model/issues';
import type {
  ConvertChange,
  MoveLaneChange,
  MoveToLaneChange,
  RenameLaneChange,
} from '../structure-commands';

export interface UpdateBlockChange {
  readonly nodeId: string;
  readonly patch: Partial<BlockData>;
}

export interface RenameBranchChange {
  readonly nodeId: string;
  readonly branchId: string;
  readonly label: string;
}

export interface UpdateBranchChange {
  readonly nodeId: string;
  readonly branchId: string;
  readonly patch: Partial<Omit<Branch, 'id'>>;
}

export interface SetDefaultBranchChange {
  readonly nodeId: string;
  readonly branchId: string | undefined;
}

export interface RemoveBranchChange {
  readonly nodeId: string;
  readonly branchId: string;
}

export interface UpdateEdgeLabelChange {
  readonly edgeId: string;
  readonly label: string;
}

export interface LaneCommands {
  readonly addLane: () => void;
  readonly renameLane: (change: RenameLaneChange) => void;
  readonly moveLane: (change: MoveLaneChange) => void;
}

/** O que o painel de propriedades pede ao editor; o estado do `useProcessEditor` já tem esse formato. */
export interface PanelCommands {
  readonly updateBlock: (change: UpdateBlockChange) => void;
  readonly addBranch: (nodeId: string) => void;
  readonly renameBranch: (change: RenameBranchChange) => void;
  readonly updateBranch: (change: UpdateBranchChange) => void;
  readonly setDefaultBranch: (change: SetDefaultBranchChange) => void;
  readonly removeBranch: (change: RemoveBranchChange) => void;
  readonly updateEdgeLabel: (change: UpdateEdgeLabelChange) => void;
  readonly duplicateSelected: () => void;
  readonly deleteSelected: () => void;
  readonly convert: (change: ConvertChange) => void;
  readonly addException: (taskId: string) => void;
  readonly moveToLane: (change: MoveToLaneChange) => void;
  readonly openSubprocess: (nodeId: string) => void;
  readonly requestInsertOnEdge: (edgeId: string) => void;
  /** Seleciona e enquadra o elemento do problema. */
  readonly focusIssue: (issue: ProcessIssue) => void;
}

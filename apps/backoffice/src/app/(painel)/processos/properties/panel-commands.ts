import type { BlockData } from '../model/blocks';

/** O que o painel de propriedades pede ao editor; o estado do `useProcessEditor` já tem esse formato. */
export interface PanelCommands {
  readonly updateBlock: (change: {
    readonly nodeId: string;
    readonly patch: Partial<BlockData>;
  }) => void;
  readonly addBranch: (nodeId: string) => void;
  readonly renameBranch: (change: {
    readonly nodeId: string;
    readonly branchId: string;
    readonly label: string;
  }) => void;
  readonly removeBranch: (change: {
    readonly nodeId: string;
    readonly branchId: string;
  }) => void;
  readonly updateEdgeLabel: (change: {
    readonly edgeId: string;
    readonly label: string;
  }) => void;
  readonly duplicateSelected: () => void;
  readonly deleteSelected: () => void;
}

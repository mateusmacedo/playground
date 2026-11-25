import { useMemo } from 'react';

import { createBranchCommands, createEditCommands } from './edit-commands';
import type { Graph } from './model/blocks';
import { findIssues } from './model/validation';
import { toProcessGraph } from './process-graph';
import { useConnectionCommands } from './use-connection-commands';
import { useGraphHistory } from './use-graph-history';

function defaultCreateId(): string {
  return crypto.randomUUID();
}

export interface UseProcessEditorParams {
  readonly initial: Graph;
  readonly createId?: () => string;
}

/** Estado e comandos do editor: o que a barra, a biblioteca, o painel e o canvas chamam. */
export function useProcessEditor(params: UseProcessEditorParams) {
  const createId = params.createId ?? defaultCreateId;
  const history = useGraphHistory(() => toProcessGraph(params.initial));
  const { graph, change } = history;
  const issues = useMemo(() => findIssues(graph), [graph]);
  const connections = useConnectionCommands({ graph, change, createId });
  const commands = createEditCommands({ change, createId });
  const branches = createBranchCommands({ change, createId });

  return { ...history, issues, ...connections, ...commands, ...branches };
}

export type ProcessEditorState = ReturnType<typeof useProcessEditor>;

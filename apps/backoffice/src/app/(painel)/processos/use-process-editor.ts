import { useMemo, useRef } from 'react';

import {
  type ClipboardRef,
  createBranchCommands,
  createEditCommands,
} from './edit-commands';
import { createEditorDocument } from './editor-document';
import type { Graph } from './model/blocks';
import type { Lane } from './model/document';
import { findIssues } from './model/validation';
import { createStructureCommands } from './structure-commands';
import { useConnectionCommands } from './use-connection-commands';
import { useDocumentHistory } from './use-document-history';

function defaultCreateId(): string {
  return crypto.randomUUID();
}

export interface UseProcessEditorParams {
  readonly initial: Graph;
  readonly lanes?: readonly Lane[];
  readonly createId?: () => string;
}

/** Estado e comandos do editor: o que a barra, a biblioteca, o painel e o canvas chamam. */
export function useProcessEditor(params: UseProcessEditorParams) {
  const createId = params.createId ?? defaultCreateId;
  const history = useDocumentHistory(() =>
    createEditorDocument({ graph: params.initial, lanes: params.lanes }),
  );
  const clipboard: ClipboardRef = useRef(null);
  const { graph, change, changeDocument, path } = history;
  const issues = useMemo(() => findIssues(graph), [graph]);
  const connections = useConnectionCommands({ graph, change, createId });
  const commands = createEditCommands({ change, createId, graph, clipboard });
  const branches = createBranchCommands({ change, createId });
  const structure = createStructureCommands({
    change,
    changeDocument,
    createId,
    path,
  });

  return {
    ...history,
    issues,
    ...connections,
    ...commands,
    ...branches,
    ...structure,
  };
}

export type ProcessEditorState = ReturnType<typeof useProcessEditor>;

import { useReactFlow } from '@xyflow/react';

import type { ProcessIssue } from './model/issues';
import type { ProcessGraph } from './process-graph';
import type { SelectOnlyParams } from './use-document-history';

const FOCUS_OPTIONS = { maxZoom: 1.2, duration: 200 } as const;

export interface UseEditorFocusParams {
  readonly graph: ProcessGraph;
  readonly selectOnly: (params: SelectOnlyParams) => void;
}

/** Levar o usuário até um elemento: selecionar só ele, enquadrar no canvas e, com isso, abrir as propriedades. */
export function useEditorFocus({ graph, selectOnly }: UseEditorFocusParams) {
  const { fitView } = useReactFlow();

  function focusNode(nodeId: string) {
    selectOnly({ nodeIds: [nodeId] });
    void fitView({ ...FOCUS_OPTIONS, nodes: [{ id: nodeId }] });
  }

  function focusEdge(edgeId: string) {
    const edge = graph.edges.find((candidate) => candidate.id === edgeId);
    selectOnly({ edgeIds: [edgeId] });
    if (edge) {
      const nodes = [{ id: edge.source }, { id: edge.target }];
      void fitView({ ...FOCUS_OPTIONS, nodes });
    }
  }

  function focusIssue(issue: ProcessIssue) {
    if (issue.nodeId !== undefined) {
      focusNode(issue.nodeId);
    } else if (issue.edgeId !== undefined) {
      focusEdge(issue.edgeId);
    }
  }

  return { focusNode, focusIssue };
}

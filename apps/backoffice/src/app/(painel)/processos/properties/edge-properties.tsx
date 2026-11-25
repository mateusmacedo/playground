import { CFormInput } from '@coreui/react';
import { useId } from 'react';

import { blockName } from '../model/blocks';
import { sourceHandleOf } from '../model/connections';
import type { ProcessIssue } from '../model/validation';
import type { ProcessEdge, ProcessGraph } from '../process-graph';
import { IssueList } from './issue-list';
import type { PanelCommands } from './panel-commands';
import { SelectionActions } from './selection-actions';

export interface EdgePropertiesProps {
  readonly edge: ProcessEdge;
  readonly graph: ProcessGraph;
  readonly issues: readonly ProcessIssue[];
  readonly commands: PanelCommands;
}

/** Propriedades da conexão selecionada: de onde sai, para onde vai e o rótulo, que no ramo vem do próprio ramo. */
export function EdgeProperties({
  edge,
  graph,
  issues,
  commands,
}: Readonly<EdgePropertiesProps>) {
  const labelId = useId();
  const source = graph.nodes.find((node) => node.id === edge.source);
  const target = graph.nodes.find((node) => node.id === edge.target);
  const branch = source?.data.branches?.find(
    (candidate) => candidate.id === sourceHandleOf(edge),
  );
  const sourceName = source ? blockName(source) : 'bloco removido';
  const targetName = target ? blockName(target) : 'bloco removido';

  return (
    <>
      <p className="small text-body-secondary">
        Conexão de {sourceName} para {targetName}.
      </p>
      {branch ? (
        <p className="small">
          O rótulo vem do ramo &quot;{branch.label}&quot;; renomeie o ramo na
          Decisão.
        </p>
      ) : (
        <CFormInput
          id={labelId}
          label="Rótulo"
          className="mb-3"
          value={edge.data?.label ?? ''}
          onChange={(event) =>
            commands.updateEdgeLabel({
              edgeId: edge.id,
              label: event.target.value,
            })
          }
        />
      )}
      <IssueList issues={issues} />
      <SelectionActions commands={commands} canDuplicate={false} />
    </>
  );
}

import { cilPlus } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormInput } from '@coreui/react';
import { useId } from 'react';

import { blockName } from '../model/blocks';
import { sourceHandleOf } from '../model/connections';
import type { ProcessIssue } from '../model/issues';
import { findOutputPort, TRANSITION_TEXT } from '../model/ports';
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

/**
 * Propriedades da conexão selecionada: origem, destino, significado da transição e rótulo. Quando a saída tem nome
 * (ramo, desfecho da espera, exceção), o rótulo vem dela.
 */
export function EdgeProperties({
  edge,
  graph,
  issues,
  commands,
}: Readonly<EdgePropertiesProps>) {
  const labelId = useId();
  const source = graph.nodes.find((node) => node.id === edge.source);
  const target = graph.nodes.find((node) => node.id === edge.target);
  const port = source
    ? findOutputPort({ node: source, handle: sourceHandleOf(edge) })
    : undefined;
  const sourceName = source ? blockName(source) : 'bloco removido';
  const targetName = target ? blockName(target) : 'bloco removido';
  const isBranch =
    port?.meaning === 'condition' || port?.meaning === 'parallel';

  return (
    <>
      <dl className="small process-edge-facts">
        <dt>Origem</dt>
        <dd>{sourceName}</dd>
        <dt>Destino</dt>
        <dd>{targetName}</dd>
        <dt>Transição</dt>
        <dd>{TRANSITION_TEXT[port?.meaning ?? 'next']}</dd>
      </dl>
      {port?.label ? (
        <p className="small">
          O rótulo &quot;{port.label}&quot; é herdado{' '}
          {isBranch
            ? `do ramo; renomeie o ramo em ${sourceName}.`
            : `da saída de ${sourceName}.`}
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
      <CButton
        color="secondary"
        variant="outline"
        size="sm"
        className="mb-3"
        onClick={() => commands.requestInsertOnEdge(edge.id)}
      >
        <CIcon icon={cilPlus} aria-hidden="true" className="me-1" />
        Inserir bloco na conexão
      </CButton>
      <IssueList issues={issues} onSelect={commands.focusIssue} />
      <SelectionActions commands={commands} duplication="absent" />
    </>
  );
}

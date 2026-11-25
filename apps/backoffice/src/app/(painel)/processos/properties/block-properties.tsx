import { CFormInput, CFormTextarea } from '@coreui/react';
import { useId } from 'react';

import { kindOf, specOf } from '../model/blocks';
import type { ProcessIssue } from '../model/validation';
import type { ProcessNode } from '../process-graph';
import { BranchEditor } from './branch-editor';
import { IssueList } from './issue-list';
import type { PanelCommands } from './panel-commands';
import { SelectionActions } from './selection-actions';

export interface BlockPropertiesProps {
  readonly node: ProcessNode;
  readonly issues: readonly ProcessIssue[];
  readonly commands: PanelCommands;
}

/** Propriedades do bloco selecionado: título ou texto, descrição da Etapa e ramos da Decisão. */
export function BlockProperties({
  node,
  issues,
  commands,
}: Readonly<BlockPropertiesProps>) {
  const kind = kindOf(node);
  const spec = specOf(kind);
  const labelId = useId();
  const descriptionId = useId();

  return (
    <>
      <p className="small text-body-secondary">
        {spec.label}: {spec.hint}
      </p>
      {kind === 'annotation' ? (
        <CFormTextarea
          id={labelId}
          label="Texto"
          rows={4}
          className="mb-3"
          value={node.data.label}
          onChange={(event) =>
            commands.updateBlock({
              nodeId: node.id,
              patch: { label: event.target.value },
            })
          }
        />
      ) : (
        <CFormInput
          id={labelId}
          label="Título"
          className="mb-3"
          value={node.data.label}
          onChange={(event) =>
            commands.updateBlock({
              nodeId: node.id,
              patch: { label: event.target.value },
            })
          }
        />
      )}
      {kind === 'task' ? (
        <CFormTextarea
          id={descriptionId}
          label="Descrição"
          rows={3}
          className="mb-3"
          value={node.data.description ?? ''}
          onChange={(event) =>
            commands.updateBlock({
              nodeId: node.id,
              patch: { description: event.target.value },
            })
          }
        />
      ) : null}
      {kind === 'decision' ? (
        <BranchEditor node={node} commands={commands} />
      ) : null}
      <IssueList issues={issues} />
      <SelectionActions commands={commands} canDuplicate />
    </>
  );
}

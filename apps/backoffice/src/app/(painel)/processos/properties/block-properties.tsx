import { CFormInput, CFormTextarea } from '@coreui/react';
import { useId } from 'react';

import { hasBranches, kindOf, specOf } from '../model/blocks';
import type { Lane } from '../model/document';
import type { ProcessIssue } from '../model/issues';
import type { ProcessGraph, ProcessNode } from '../process-graph';
import { BlockActions } from './block-actions';
import { BlockFields } from './block-fields';
import { BranchEditor } from './branch-editor';
import { IssueList } from './issue-list';
import type { PanelCommands } from './panel-commands';
import { SelectionActions } from './selection-actions';

export interface BlockPropertiesProps {
  readonly node: ProcessNode;
  readonly graph: ProcessGraph;
  readonly lanes: readonly Lane[];
  readonly issues: readonly ProcessIssue[];
  readonly commands: PanelCommands;
}

/** Propriedades do bloco selecionado: tipo, título, campos do tipo, ramos, ações, problemas, duplicar e excluir. */
export function BlockProperties({
  node,
  graph,
  lanes,
  issues,
  commands,
}: Readonly<BlockPropertiesProps>) {
  const kind = kindOf(node);
  const spec = specOf(kind);
  const labelId = useId();
  const updateLabel = (label: string) =>
    commands.updateBlock({ nodeId: node.id, patch: { label } });

  return (
    <>
      <p className="small text-body-secondary">
        <span className="fw-semibold">{spec.label}</span>: {spec.hint}
      </p>
      {kind === 'annotation' ? (
        <CFormTextarea
          id={labelId}
          label="Texto"
          rows={4}
          className="mb-3"
          value={node.data.label}
          onChange={(event) => updateLabel(event.target.value)}
        />
      ) : (
        <CFormInput
          id={labelId}
          label="Título"
          className="mb-3"
          value={node.data.label}
          onChange={(event) => updateLabel(event.target.value)}
        />
      )}
      <BlockFields node={node} graph={graph} commands={commands} />
      {hasBranches(kind) ? (
        <BranchEditor node={node} commands={commands} />
      ) : null}
      <BlockActions
        node={node}
        graph={graph}
        lanes={lanes}
        commands={commands}
      />
      <IssueList issues={issues} onSelect={commands.focusIssue} />
      <SelectionActions commands={commands} canDuplicate />
    </>
  );
}

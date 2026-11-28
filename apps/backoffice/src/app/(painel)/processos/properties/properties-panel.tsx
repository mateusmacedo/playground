import { useId } from 'react';

import type { Lane } from '../model/document';
import type { ProcessIssue } from '../model/issues';
import type { ProcessGraph } from '../process-graph';
import { BlockProperties } from './block-properties';
import { EdgeProperties } from './edge-properties';
import { IssueList } from './issue-list';
import type { PanelCommands } from './panel-commands';
import { SelectionActions } from './selection-actions';

interface CountParams {
  readonly amount: number;
  readonly singular: string;
  readonly plural: string;
}

function count(params: CountParams): string {
  const { amount, singular, plural } = params;
  return `${amount} ${amount === 1 ? singular : plural}`;
}

interface PanelContentProps {
  readonly graph: ProcessGraph;
  readonly lanes: readonly Lane[];
  readonly issues: readonly ProcessIssue[];
  readonly commands: PanelCommands;
}

function PanelContent({
  graph,
  lanes,
  issues,
  commands,
}: Readonly<PanelContentProps>) {
  const nodes = graph.nodes.filter((node) => node.selected);
  const edges = graph.edges.filter((edge) => edge.selected);
  const selected = nodes.length + edges.length;
  const issuesOf = (elementId: string) =>
    issues.filter(
      (issue) => issue.nodeId === elementId || issue.edgeId === elementId,
    );

  if (selected === 0) {
    const blocks = count({
      amount: graph.nodes.length,
      singular: 'bloco',
      plural: 'blocos',
    });
    const connections = count({
      amount: graph.edges.length,
      singular: 'conexão',
      plural: 'conexões',
    });
    return (
      <>
        <p className="small text-body-secondary">
          {blocks} e {connections}. Selecione um elemento para editar.
        </p>
        <IssueList
          issues={issues}
          emptyText="Nenhum problema encontrado."
          onSelect={commands.focusIssue}
        />
      </>
    );
  }
  if (selected > 1) {
    const items = count({
      amount: selected,
      singular: 'item selecionado',
      plural: 'itens selecionados',
    });
    return (
      <>
        <p className="small">{items}.</p>
        <SelectionActions
          commands={commands}
          duplication={nodes.length > 0 ? 'available' : 'unavailable'}
        />
      </>
    );
  }
  const [node] = nodes;
  if (node) {
    return (
      <BlockProperties
        key={node.id}
        node={node}
        graph={graph}
        lanes={lanes}
        issues={issuesOf(node.id)}
        commands={commands}
      />
    );
  }
  const [edge] = edges;
  return (
    <EdgeProperties
      key={edge.id}
      edge={edge}
      graph={graph}
      issues={issuesOf(edge.id)}
      commands={commands}
    />
  );
}

export interface PropertiesPanelProps {
  readonly graph: ProcessGraph;
  readonly lanes: readonly Lane[];
  readonly issues: readonly ProcessIssue[];
  readonly commands: PanelCommands;
}

/** Painel contextual: resumo do processo, seleção múltipla ou as propriedades do elemento selecionado. */
export function PropertiesPanel(props: Readonly<PropertiesPanelProps>) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="h6">
        Propriedades
      </h2>
      <PanelContent {...props} />
    </section>
  );
}

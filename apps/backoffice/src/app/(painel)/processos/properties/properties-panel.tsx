import { useId } from 'react';

import type { ProcessIssue } from '../model/validation';
import type { ProcessGraph } from '../process-graph';
import { BlockProperties } from './block-properties';
import { EdgeProperties } from './edge-properties';
import { IssueList } from './issue-list';
import type { PanelCommands } from './panel-commands';
import { SelectionActions } from './selection-actions';

function count(params: {
  readonly amount: number;
  readonly singular: string;
  readonly plural: string;
}): string {
  const { amount, singular, plural } = params;
  return `${amount} ${amount === 1 ? singular : plural}`;
}

function PanelContent({
  graph,
  issues,
  commands,
}: Readonly<{
  graph: ProcessGraph;
  issues: readonly ProcessIssue[];
  commands: PanelCommands;
}>) {
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
        <IssueList issues={issues} emptyText="Nenhum problema encontrado." />
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
        <SelectionActions commands={commands} canDuplicate={nodes.length > 0} />
      </>
    );
  }
  const [node] = nodes;
  if (node) {
    return (
      <BlockProperties
        key={node.id}
        node={node}
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

/** Painel contextual: resumo do processo, seleção múltipla ou as propriedades do elemento selecionado. */
export function PropertiesPanel(
  props: Readonly<{
    graph: ProcessGraph;
    issues: readonly ProcessIssue[];
    commands: PanelCommands;
  }>,
) {
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

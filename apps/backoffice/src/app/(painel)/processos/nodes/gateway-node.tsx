import type { NodeProps } from '@xyflow/react';

import { useElementIssues } from '../issues-context';
import { type BlockKind, blockName, kindOf, specOf } from '../model/blocks';
import type { PortNode } from '../model/ports';
import type { ProcessNode } from '../process-graph';
import { BlockPorts } from './block-node';
import { blockClassName, IssueMarker } from './issue-marker';

/** Símbolo de cada desvio, como na notação BPMN: × exclusivo, ○ inclusivo e + paralelo. */
const SYMBOL: Readonly<Partial<Record<BlockKind, string>>> = {
  decision: '×',
  merge: '×',
  'inclusive-split': '○',
  'inclusive-join': '○',
  'parallel-split': '+',
  'parallel-join': '+',
};

const JOINS = new Set<BlockKind>(['merge', 'inclusive-join', 'parallel-join']);

/** Decisões, aberturas e as reuniões delas: losango com o símbolo do tipo; as reuniões têm desenho próprio. */
export function GatewayNode({ id, type, data }: NodeProps<ProcessNode>) {
  const kind = kindOf({ type });
  const spec = specOf(kind);
  const issues = useElementIssues(id);
  const node: PortNode = { type: kind, data };
  const name = blockName(node);
  const shape = JOINS.has(kind)
    ? 'process-gateway--join'
    : 'process-gateway--split';

  return (
    <div
      className={`${blockClassName({ kind, issues })} process-gateway ${shape}`}
    >
      <span className="process-gateway__symbol" aria-hidden="true">
        {SYMBOL[kind]}
      </span>
      <span className="process-gateway__text">
        {name === spec.label ? null : (
          <span className="process-block__kind">{spec.label}</span>
        )}
        <strong className="process-block__label">{name}</strong>
      </span>
      <IssueMarker issues={issues} />
      <BlockPorts id={id} node={node} />
    </div>
  );
}

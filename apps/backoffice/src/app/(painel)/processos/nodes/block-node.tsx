import { Handle, type NodeProps, Position } from '@xyflow/react';

import { useElementIssues } from '../issues-context';
import {
  blockName,
  INPUT_HANDLE,
  kindOf,
  OUTPUT_HANDLE,
  specOf,
} from '../model/blocks';
import type { ProcessNode } from '../process-graph';
import { blockClassName, IssueMarker } from './issue-marker';

/** Início, Etapa, Convergência e Fim: entrada em cima e saída única embaixo, quando o tipo tem. */
export function BlockNode({ id, type, data }: NodeProps<ProcessNode>) {
  const kind = kindOf({ type });
  const spec = specOf(kind);
  const issues = useElementIssues(id);
  const name = blockName({ type: kind, data });

  return (
    <div className={blockClassName({ kind, invalid: issues.length > 0 })}>
      {spec.input === 'none' ? null : (
        <Handle
          type="target"
          position={Position.Top}
          id={INPUT_HANDLE}
          aria-label={`Entrada de ${name}`}
        />
      )}
      {name === spec.label ? null : (
        <span className="process-block__kind">{spec.label}</span>
      )}
      <strong className="process-block__label">{name}</strong>
      {data.description ? (
        <span className="process-block__description">{data.description}</span>
      ) : null}
      <IssueMarker issues={issues} />
      {spec.output === 'single' ? (
        <Handle
          type="source"
          position={Position.Bottom}
          id={OUTPUT_HANDLE}
          aria-label={`Saída de ${name}`}
        />
      ) : null}
    </div>
  );
}

import {
  Handle,
  type NodeProps,
  Position,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { useEffect } from 'react';

import { useElementIssues } from '../issues-context';
import { blockName, INPUT_HANDLE, specOf } from '../model/blocks';
import type { ProcessNode } from '../process-graph';
import { blockClassName, IssueMarker } from './issue-marker';

const KIND_LABEL = specOf('decision').label;

/** Decisão: uma entrada e um ponto de saída por ramo, distribuídos na base do bloco sob o nome de cada ramo. */
export function DecisionNode({ id, data }: NodeProps<ProcessNode>) {
  const issues = useElementIssues(id);
  const updateNodeInternals = useUpdateNodeInternals();
  const branches = data.branches ?? [];
  const handleIds = branches.map((branch) => branch.id).join(' ');
  const name = blockName({ type: 'decision', data });

  // biome-ignore lint/correctness/useExhaustiveDependencies: criar ou remover ramo muda os pontos de saída, e o React Flow só os remede quando avisado.
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, handleIds, updateNodeInternals]);

  return (
    <div
      className={blockClassName({
        kind: 'decision',
        invalid: issues.length > 0,
      })}
    >
      <Handle
        type="target"
        position={Position.Top}
        id={INPUT_HANDLE}
        aria-label={`Entrada de ${name}`}
      />
      {name === KIND_LABEL ? null : (
        <span className="process-block__kind">{KIND_LABEL}</span>
      )}
      <strong className="process-block__label">{name}</strong>
      <IssueMarker issues={issues} />
      <div className="process-branches">
        {branches.map((branch, index) => (
          <span key={branch.id} className="process-branch">
            {branch.label}
            <Handle
              type="source"
              position={Position.Bottom}
              id={branch.id}
              style={{ left: `${((index + 0.5) / branches.length) * 100}%` }}
              aria-label={`Ramo ${branch.label} de ${name}`}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

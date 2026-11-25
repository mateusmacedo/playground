import {
  Handle,
  type NodeProps,
  Position,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { useEffect } from 'react';

import { useElementIssues } from '../issues-context';
import { blockName, INPUT_HANDLE, kindOf, specOf } from '../model/blocks';
import {
  inputPortLabel,
  type OutputPort,
  outputPortLabel,
  outputPorts,
  type PortNode,
} from '../model/ports';
import type { ProcessNode } from '../process-graph';
import { blockClassName, IssueMarker } from './issue-marker';

interface NamedOutputsProps {
  readonly node: PortNode;
  readonly ports: readonly OutputPort[];
}

/** Saídas com nome (ramos, desfechos da espera), distribuídas na base do bloco, cada uma sob o próprio nome. */
function NamedOutputs({ node, ports }: Readonly<NamedOutputsProps>) {
  return (
    <div className="process-branches">
      {ports.map((port, index) => (
        <span key={port.id} className="process-branch">
          {port.label}
          <Handle
            type="source"
            position={Position.Bottom}
            id={port.id}
            style={{ left: `${((index + 0.5) / ports.length) * 100}%` }}
            aria-label={outputPortLabel({ node, port })}
          />
        </span>
      ))}
    </div>
  );
}

/** Bloco do processo: cor e nome do tipo, entrada em cima e as saídas que o tipo tem embaixo. */
export function BlockNode({ id, type, data }: NodeProps<ProcessNode>) {
  const kind = kindOf({ type });
  const spec = specOf(kind);
  const issues = useElementIssues(id);
  const updateNodeInternals = useUpdateNodeInternals();
  const node: PortNode = { type: kind, data };
  const name = blockName(node);
  const ports = outputPorts(node);
  const portIds = ports.map((port) => port.id).join(' ');
  const [singlePort] = ports;
  const isSingleUnnamed =
    ports.length === 1 && singlePort !== undefined && spec.output === 'single';

  // biome-ignore lint/correctness/useExhaustiveDependencies: criar ou remover uma saída muda os pontos, e o React Flow só os remede quando avisado.
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, portIds, updateNodeInternals]);

  return (
    <div className={blockClassName({ kind, invalid: issues.length > 0 })}>
      {spec.input === 'none' ? null : (
        <Handle
          type="target"
          position={Position.Top}
          id={INPUT_HANDLE}
          aria-label={inputPortLabel(node)}
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
      {isSingleUnnamed ? (
        <Handle
          type="source"
          position={Position.Bottom}
          id={singlePort.id}
          aria-label={outputPortLabel({ node, port: singlePort })}
        />
      ) : null}
      {!isSingleUnnamed && ports.length > 0 ? (
        <NamedOutputs node={node} ports={ports} />
      ) : null}
    </div>
  );
}

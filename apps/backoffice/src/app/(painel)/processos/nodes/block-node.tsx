import { cilExternalLink } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import {
  Handle,
  type NodeProps,
  Position,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { useEffect } from 'react';

import { useCanvasActions } from '../canvas-actions';
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
import { nodeDetail } from './node-details';

export interface PortsProps {
  readonly node: PortNode;
  readonly ports: readonly OutputPort[];
}

/**
 * Saídas com nome (ramos, desfechos da espera, pareceres da aprovação), distribuídas na base do bloco, cada uma sob o
 * próprio nome.
 */
export function NamedOutputs({ node, ports }: Readonly<PortsProps>) {
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

export interface BlockPortsProps {
  readonly id: string;
  readonly node: PortNode;
}

/** Pontos de entrada e saída do bloco conforme o tipo; o React Flow é avisado quando as saídas mudam. */
export function BlockPorts({ id, node }: Readonly<BlockPortsProps>) {
  const spec = specOf(kindOf(node));
  const ports = outputPorts(node);
  const portIds = ports.map((port) => port.id).join(' ');
  const updateNodeInternals = useUpdateNodeInternals();
  const [single] = ports;
  const isSingle = spec.output === 'single' && single !== undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: criar ou remover uma saída muda os pontos, e o React Flow só os remede quando avisado.
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, portIds, updateNodeInternals]);

  return (
    <>
      {spec.input === 'none' ? null : (
        <Handle
          type="target"
          position={Position.Top}
          id={INPUT_HANDLE}
          aria-label={inputPortLabel(node)}
        />
      )}
      {isSingle ? (
        <Handle
          type="source"
          position={Position.Bottom}
          id={single.id}
          aria-label={outputPortLabel({ node, port: single })}
        />
      ) : null}
      {!isSingle && ports.length > 0 ? (
        <NamedOutputs node={node} ports={ports} />
      ) : null}
    </>
  );
}

interface SubprocessSummaryProps {
  readonly data: ProcessNode['data'];
}

/** Representação externa do subprocesso: o que ele recebe e o que devolve, além do objetivo. */
function SubprocessSummary({ data }: Readonly<SubprocessSummaryProps>) {
  const inputs = data.inputs?.trim();
  const outputs = data.outputs?.trim();
  if (!inputs && !outputs) {
    return null;
  }
  return (
    <dl className="process-block__io">
      {inputs ? (
        <>
          <dt>Entradas</dt>
          <dd>{inputs}</dd>
        </>
      ) : null}
      {outputs ? (
        <>
          <dt>Saídas</dt>
          <dd>{outputs}</dd>
        </>
      ) : null}
    </dl>
  );
}

/** Atividades, esperas e subprocesso: cor e nome do tipo, o detalhe principal e as saídas que o tipo tem. */
export function BlockNode({ id, type, data }: NodeProps<ProcessNode>) {
  const kind = kindOf({ type });
  const spec = specOf(kind);
  const issues = useElementIssues(id);
  const { openSubprocess } = useCanvasActions();
  const node: PortNode = { type: kind, data };
  const name = blockName(node);
  const detail = nodeDetail(node);

  return (
    <div className={blockClassName({ kind, issues })}>
      {name === spec.label ? null : (
        <span className="process-block__kind">{spec.label}</span>
      )}
      <strong className="process-block__label">{name}</strong>
      {detail ? (
        <span className="process-block__description">{detail}</span>
      ) : null}
      {kind === 'subprocess' ? <SubprocessSummary data={data} /> : null}
      {kind === 'subprocess' ? (
        <button
          type="button"
          className="btn btn-link btn-sm p-0 nodrag process-block__open"
          onClick={() => openSubprocess(id)}
        >
          <CIcon icon={cilExternalLink} aria-hidden="true" className="me-1" />
          Abrir {name}
        </button>
      ) : null}
      <IssueMarker issues={issues} />
      <BlockPorts id={id} node={node} />
    </div>
  );
}

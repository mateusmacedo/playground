import { cilBolt, cilMediaPlay, cilMediaStop } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import type { NodeProps } from '@xyflow/react';

import { useElementIssues } from '../issues-context';
import { blockName, kindOf, specOf } from '../model/blocks';
import type { PortNode } from '../model/ports';
import type { ProcessNode } from '../process-graph';
import { BlockPorts } from './block-node';
import { blockClassName, IssueMarker } from './issue-marker';
import { nodeDetail } from './node-details';

const ICON = { start: cilMediaPlay, end: cilMediaStop, exception: cilBolt };

/**
 * Início, Fim e Evento de exceção. A exceção é um círculo pequeno preso à borda da tarefa: traço contínuo quando
 * interrompe a atividade, tracejado quando abre um caminho a mais sem interromper.
 */
export function EventNode({ id, type, data }: NodeProps<ProcessNode>) {
  const kind = kindOf({ type });
  const spec = specOf(kind);
  const issues = useElementIssues(id);
  const node: PortNode = { type: kind, data };
  const name = blockName(node);
  const icon = kind === 'start' || kind === 'end' ? ICON[kind] : ICON.exception;

  if (kind === 'exception') {
    const mode =
      data.interrupting === false ? 'non-interrupting' : 'interrupting';
    return (
      <div
        className={`${blockClassName({ kind, issues })} process-exception process-exception--${mode}`}
        title={name}
      >
        <CIcon icon={icon} aria-hidden="true" />
        <span className="visually-hidden">{`${spec.label}: ${name}`}</span>
        <IssueMarker issues={issues} />
        <BlockPorts id={id} node={node} />
      </div>
    );
  }

  const detail = nodeDetail(node);
  return (
    <div className={`${blockClassName({ kind, issues })} process-event`}>
      <CIcon icon={icon} aria-hidden="true" className="process-event__icon" />
      <span>
        {name === spec.label ? null : (
          <span className="process-block__kind">{spec.label}</span>
        )}
        <strong className="process-block__label">{name}</strong>
        {detail ? (
          <span className="process-block__description">{detail}</span>
        ) : null}
      </span>
      <IssueMarker issues={issues} />
      <BlockPorts id={id} node={node} />
    </div>
  );
}

import {
  type ConnectionLineComponentProps,
  getSmoothStepPath,
} from '@xyflow/react';

import { useCanvasActions } from './canvas-actions';

/** Distância entre a ponta da linha e o texto da recusa, para ele não cobrir o ponto de chegada. */
const REASON_OFFSET = 14;

/**
 * Linha da conexão sendo arrastada: verde sobre um ponto que aceita, vermelha e tracejada sobre um que recusa, e com o
 * motivo da recusa escrito ao lado da ponta.
 */
export function ProcessConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  connectionStatus,
  fromNode,
  fromHandle,
  toNode,
  toHandle,
}: ConnectionLineComponentProps) {
  const { explainConnection } = useCanvasActions();
  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });
  const reason =
    connectionStatus === 'invalid' && toNode && toHandle
      ? explainConnection({
          fromNodeId: fromNode.id,
          fromHandleId: fromHandle.id ?? null,
          fromHandleRole: fromHandle.type,
          toNodeId: toNode.id,
          toHandleId: toHandle.id ?? null,
        })
      : null;
  return (
    <g>
      <path
        className={`process-connection-line process-connection-line--${connectionStatus ?? 'idle'}`}
        d={path}
        fill="none"
      />
      {reason ? (
        <text
          className="process-connection-reason"
          x={toX + REASON_OFFSET}
          y={toY - REASON_OFFSET}
        >
          {reason}
        </text>
      ) : null}
    </g>
  );
}

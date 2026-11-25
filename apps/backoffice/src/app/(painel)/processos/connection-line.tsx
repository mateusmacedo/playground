import {
  type ConnectionLineComponentProps,
  getSmoothStepPath,
} from '@xyflow/react';

/** Linha da conexão sendo arrastada: verde sobre um ponto que aceita, vermelha e tracejada sobre um que recusa. */
export function ProcessConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  connectionStatus,
}: ConnectionLineComponentProps) {
  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });
  return (
    <path
      className={`process-connection-line process-connection-line--${connectionStatus ?? 'idle'}`}
      d={path}
      fill="none"
    />
  );
}

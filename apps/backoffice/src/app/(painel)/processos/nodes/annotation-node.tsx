import type { NodeProps } from '@xyflow/react';

import type { ProcessNode } from '../process-graph';

/** Anotação: nota livre no canvas, sem pontos de conexão. */
export function AnnotationNode({ data }: NodeProps<ProcessNode>) {
  return (
    <div className="process-annotation">
      {data.label.trim() || 'Anotação vazia'}
    </div>
  );
}

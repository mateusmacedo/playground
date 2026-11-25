import type { NodeTypes } from '@xyflow/react';

import { AnnotationNode } from './annotation-node';
import { BlockNode } from './block-node';
import { DecisionNode } from './decision-node';

// NOTE: fora de componente de propósito; um objeto novo a cada render faz o React Flow remontar todos os blocos.
export const nodeTypes: NodeTypes = {
  start: BlockNode,
  task: BlockNode,
  merge: BlockNode,
  end: BlockNode,
  decision: DecisionNode,
  annotation: AnnotationNode,
};

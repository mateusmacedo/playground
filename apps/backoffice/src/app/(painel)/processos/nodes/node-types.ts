import type { NodeTypes } from '@xyflow/react';

import type { BlockKind } from '../model/blocks';
import { AnnotationNode } from './annotation-node';
import { BlockNode } from './block-node';

// NOTE: fora de componente de propósito; um objeto novo a cada render faz o React Flow remontar todos os blocos.
export const nodeTypes: NodeTypes = {
  start: BlockNode,
  task: BlockNode,
  'human-task': BlockNode,
  'automated-task': BlockNode,
  'send-message': BlockNode,
  'wait-event': BlockNode,
  timer: BlockNode,
  decision: BlockNode,
  merge: BlockNode,
  'inclusive-split': BlockNode,
  'inclusive-join': BlockNode,
  'parallel-split': BlockNode,
  'parallel-join': BlockNode,
  exception: BlockNode,
  subprocess: BlockNode,
  end: BlockNode,
  annotation: AnnotationNode,
} satisfies Record<BlockKind, NodeTypes[string]>;

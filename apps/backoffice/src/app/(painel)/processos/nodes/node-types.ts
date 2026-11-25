import type { NodeTypes } from '@xyflow/react';

import type { BlockKind } from '../model/blocks';
import { AnnotationNode } from './annotation-node';
import { BlockNode } from './block-node';
import { EventNode } from './event-node';
import { GatewayNode } from './gateway-node';

// NOTE: fora de componente de propósito; um objeto novo a cada render faz o React Flow remontar todos os blocos.
export const nodeTypes: NodeTypes = {
  start: EventNode,
  task: BlockNode,
  'human-task': BlockNode,
  'automated-task': BlockNode,
  'send-message': BlockNode,
  'wait-event': BlockNode,
  timer: BlockNode,
  decision: GatewayNode,
  merge: GatewayNode,
  'inclusive-split': GatewayNode,
  'inclusive-join': GatewayNode,
  'parallel-split': GatewayNode,
  'parallel-join': GatewayNode,
  exception: EventNode,
  subprocess: BlockNode,
  end: EventNode,
  annotation: AnnotationNode,
} satisfies Record<BlockKind, NodeTypes[string]>;

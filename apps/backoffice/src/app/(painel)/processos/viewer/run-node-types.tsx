import type { NodeTypes } from '@xyflow/react';
import type { ComponentProps } from 'react';

import { nodeTypes } from '../nodes/node-types';
import { RunMarkBadge } from './run-mark-badge';
import { useNodeMark } from './run-marks-context';

type NodeComponent = NodeTypes[string];

/** O bloco do editor com o selo da marca da execução por cima, quando a execução já o alcançou. */
function withRunMark(Component: NodeComponent): NodeComponent {
  function MarkedNode(props: ComponentProps<NodeComponent>) {
    const mark = useNodeMark(props.id);
    return (
      <>
        <Component {...props} />
        {mark === undefined ? null : <RunMarkBadge mark={mark} />}
      </>
    );
  }
  return MarkedNode;
}

function markedTypes(types: NodeTypes): NodeTypes {
  const marked: NodeTypes = {};
  for (const [kind, Component] of Object.entries(types)) {
    marked[kind] = withRunMark(Component);
  }
  return marked;
}

// WHY: os tipos saem dos blocos do editor, sem lista própria: um tipo novo de bloco aparece no diagrama sem mexer aqui.
// NOTE: fora de componente de propósito; um objeto novo a cada render faz o React Flow remontar todos os blocos.
export const runNodeTypes: NodeTypes = markedTypes(nodeTypes);

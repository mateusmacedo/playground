import { cilCheckAlt } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from '@xyflow/react';

import { useEdgeDisplay } from '../edges/edge-display-context';
import type { ProcessEdge } from '../process-graph';
import { RUN_EDGE_TYPE } from './run-graph';
import { TAKEN_TEXT } from './run-marks';
import { useEdgeTaken } from './run-marks-context';

/**
 * Conexão do diagrama da execução: em degraus e com seta, como no editor, mas sem o botão de inserir bloco. O rótulo
 * mostra o significado da transição, o nome e, quando a execução já passou por ela, a marca de caminho percorrido.
 */
export function RunEdgeView(props: EdgeProps<ProcessEdge>) {
  const { id, markerEnd, style } = props;
  const display = useEdgeDisplay(id);
  const taken = useEdgeTaken(id);
  const [path, labelX, labelY] = getSmoothStepPath(props);
  const showMeaning = display.meaning !== 'next';
  const hasLabel = showMeaning || display.text !== '' || taken;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {hasLabel ? (
        <EdgeLabelRenderer>
          <div
            className="process-edge-label process-run-edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {taken ? (
              <span className="process-run-edge-label__taken">
                <CIcon icon={cilCheckAlt} aria-hidden="true" />
                <span className="visually-hidden">{TAKEN_TEXT}</span>
              </span>
            ) : null}
            {showMeaning ? (
              <span className="process-edge-label__meaning">
                {display.meaningText}
              </span>
            ) : null}
            {display.text ? (
              <span className="process-edge-label__text">{display.text}</span>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

// NOTE: fora de componente, pelo mesmo motivo dos tipos de bloco.
export const runEdgeTypes = { [RUN_EDGE_TYPE]: RunEdgeView };

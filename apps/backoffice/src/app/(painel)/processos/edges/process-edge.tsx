import { cilPlus } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from '@xyflow/react';

import { useCanvasActions } from '../canvas-actions';
import type { ProcessEdge } from '../process-graph';
import { useEdgeDisplay } from './edge-display-context';

/**
 * Conexão em degraus com seta. O rótulo mostra o nome (ramo, desfecho ou o digitado) e o significado da transição; o
 * "+" no meio divide a conexão e insere um bloco nela.
 */
export function ProcessEdgeView(props: EdgeProps<ProcessEdge>) {
  const { id, markerEnd, style, selected } = props;
  const { requestInsertOnEdge } = useCanvasActions();
  const display = useEdgeDisplay(id);
  const [path, labelX, labelY] = getSmoothStepPath(props);
  const showMeaning = display.meaning !== 'next';

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className={`process-edge-label nodrag nopan${selected ? ' process-edge-label--selected' : ''}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {showMeaning ? (
            <span className="process-edge-label__meaning">
              {display.meaningText}
            </span>
          ) : null}
          {display.text ? (
            <span className="process-edge-label__text">{display.text}</span>
          ) : null}
          <button
            type="button"
            className="process-edge-label__insert"
            aria-label={`Inserir bloco na ${display.description}`}
            onClick={() => requestInsertOnEdge(id)}
          >
            <CIcon icon={cilPlus} aria-hidden="true" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

// NOTE: fora de componente, pelo mesmo motivo dos `nodeTypes`.
export const edgeTypes = { process: ProcessEdgeView };

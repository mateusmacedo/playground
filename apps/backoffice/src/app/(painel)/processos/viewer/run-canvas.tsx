import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import { useMemo } from 'react';

import { type CanvasActions, CanvasActionsProvider } from '../canvas-actions';
import { EdgeDisplayProvider } from '../edges/edge-display-context';
import { IssuesProvider } from '../issues-context';
import { LanesLayer } from '../lanes-layer';
import type { Lane } from '../model/document';
import { GRID_STEP } from '../model/geometry';
import { edgeDisplays, type ProcessGraph } from '../process-graph';
import { runEdgeTypes } from './run-edge';
import { NO_ISSUES, runEdges, runNodes } from './run-graph';
import { type LevelMarks, RunMarksProvider } from './run-marks-context';
import { runNodeTypes } from './run-node-types';
import { viewerAriaLabels } from './viewer-aria-labels';

const FIT_VIEW = { maxZoom: 1.2 };

export interface RunCanvasProps {
  /** Blocos e conexões do nível mostrado. */
  readonly level: ProcessGraph;
  /** Raias ao fundo; vazio dentro de um subprocesso. */
  readonly lanes: readonly Lane[];
  readonly marks: LevelMarks;
  readonly onOpenSubprocess: (nodeId: string) => void;
}

/**
 * Um nível do processo no React Flow, somente leitura: os blocos do editor com as marcas da execução, sem arrastar,
 * ligar, selecionar nem remover. Dos comandos do editor, só "abrir subprocesso" age.
 */
export function RunCanvas({
  level,
  lanes,
  marks,
  onOpenSubprocess,
}: Readonly<RunCanvasProps>) {
  const displays = useMemo(() => edgeDisplays(level), [level]);
  const nodes = useMemo(
    () => runNodes({ nodes: level.nodes, marks: marks.nodes }),
    [level.nodes, marks.nodes],
  );
  const edges = useMemo(
    () => runEdges({ graph: level, takenEdges: marks.takenEdges }),
    [level, marks.takenEdges],
  );
  // NOTE: os blocos do editor pedem estes comandos; aqui não há conexão para inserir bloco nem ligação para explicar.
  const actions = useMemo<CanvasActions>(
    () => ({
      openSubprocess: onOpenSubprocess,
      requestInsertOnEdge: () => undefined,
      explainConnection: () => null,
    }),
    [onOpenSubprocess],
  );

  return (
    <CanvasActionsProvider value={actions}>
      <IssuesProvider value={NO_ISSUES}>
        <EdgeDisplayProvider value={displays}>
          <RunMarksProvider value={marks}>
            <ReactFlow
              aria-label="Diagrama da execução"
              nodes={nodes}
              edges={edges}
              nodeTypes={runNodeTypes}
              edgeTypes={runEdgeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              edgesReconnectable={false}
              deleteKeyCode={null}
              disableKeyboardA11y
              fitView
              fitViewOptions={FIT_VIEW}
              ariaLabelConfig={viewerAriaLabels}
            >
              <LanesLayer lanes={lanes} />
              <Background gap={GRID_STEP} />
              <Controls showInteractive={false} fitViewOptions={FIT_VIEW} />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </RunMarksProvider>
        </EdgeDisplayProvider>
      </IssuesProvider>
    </CanvasActionsProvider>
  );
}

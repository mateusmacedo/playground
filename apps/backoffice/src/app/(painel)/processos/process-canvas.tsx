import {
  Background,
  Controls,
  type FinalConnectionState,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import { type DragEvent, useMemo } from 'react';

import { ariaLabels } from './aria-labels';
import { BLOCK_DRAG_TYPE } from './block-palette';
import type { PickerRequest } from './block-picker';
import { CanvasActionsProvider } from './canvas-actions';
import { ProcessConnectionLine } from './connection-line';
import { EdgeDisplayProvider } from './edges/edge-display-context';
import { edgeTypes } from './edges/process-edge';
import { IssuesProvider } from './issues-context';
import { LanesLayer } from './lanes-layer';
import { isBlockKind, type Point } from './model/blocks';
import { GRID_STEP } from './model/geometry';
import { nodeTypes } from './nodes/node-types';
import {
  blockOrigin,
  displayEdges,
  displayNodes,
  edgeDisplays,
  issuesByElement,
  taskAtPoint,
} from './process-graph';
import type { ProcessEditorState } from './use-process-editor';

const SNAP_GRID: [number, number] = [GRID_STEP, GRID_STEP];

function pointerOf(event: MouseEvent | TouchEvent): Point | null {
  if ('changedTouches' in event) {
    const touch = event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: event.clientX, y: event.clientY };
}

export interface ProcessCanvasProps {
  readonly editor: ProcessEditorState;
  readonly onRequestPick: (request: PickerRequest) => void;
}

/**
 * O canvas do React Flow ligado ao estado do editor: drop dos blocos da biblioteca, ligação solta numa área vazia
 * (abre a biblioteca filtrada) e as raias ao fundo, só no processo principal.
 */
export function ProcessCanvas({
  editor,
  onRequestPick,
}: Readonly<ProcessCanvasProps>) {
  const { screenToFlowPosition } = useReactFlow();
  const { graph, issues } = editor;
  const issuesById = useMemo(() => issuesByElement(issues), [issues]);
  const displays = useMemo(() => edgeDisplays(graph), [graph]);
  const nodes = useMemo(() => displayNodes(graph.nodes), [graph.nodes]);
  const edges = useMemo(
    () => displayEdges({ graph, issuesById }),
    [graph, issuesById],
  );
  const actions = useMemo(
    () => ({
      openSubprocess: editor.openSubprocess,
      requestInsertOnEdge: (edgeId: string) =>
        onRequestPick({ purpose: 'edge', edgeId }),
      explainConnection: editor.explainConnection,
    }),
    [editor.openSubprocess, editor.explainConnection, onRequestPick],
  );

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes(BLOCK_DRAG_TYPE)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    const kind = event.dataTransfer.getData(BLOCK_DRAG_TYPE);
    if (!isBlockKind(kind)) {
      return;
    }
    event.preventDefault();
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const task =
      kind === 'exception' ? taskAtPoint({ graph, point }) : undefined;
    if (task) {
      editor.addException(task.id);
      return;
    }
    editor.addBlock({ kind, position: blockOrigin(point) });
  }

  // WHY: a assinatura posicional é a que o React Flow chama no `onConnectEnd`.
  function handleConnectEnd(
    event: MouseEvent | TouchEvent,
    state: FinalConnectionState,
  ) {
    const pointer = pointerOf(event);
    const droppedOnPane = !state.isValid && state.toNode === null;
    if (!droppedOnPane) {
      editor.reportRefusal(state);
      return;
    }
    if (!state.fromNode || !state.fromHandle || !pointer) {
      return;
    }
    if (state.fromHandle.type !== 'source') {
      return;
    }
    onRequestPick({
      purpose: 'output',
      source: state.fromNode.id,
      sourceHandle: state.fromHandle.id ?? null,
      position: blockOrigin(screenToFlowPosition(pointer)),
    });
  }

  return (
    <CanvasActionsProvider value={actions}>
      <IssuesProvider value={issuesById}>
        <EdgeDisplayProvider value={displays}>
          <ReactFlow
            aria-label="Canvas do processo"
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={editor.onNodesChange}
            onEdgesChange={editor.onEdgesChange}
            onNodeDragStart={editor.onDragStart}
            onNodeDragStop={editor.onDragStop}
            onSelectionDragStart={editor.onDragStart}
            onSelectionDragStop={editor.onDragStop}
            onConnect={editor.onConnect}
            onConnectEnd={handleConnectEnd}
            isValidConnection={editor.isValidConnection}
            onReconnectStart={editor.onReconnectStart}
            onReconnect={editor.onReconnect}
            onReconnectEnd={editor.onReconnectEnd}
            connectionLineComponent={ProcessConnectionLine}
            deleteKeyCode={null}
            snapToGrid
            snapGrid={SNAP_GRID}
            fitView
            fitViewOptions={{ maxZoom: 1.2 }}
            ariaLabelConfig={ariaLabels}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {editor.path.length === 0 ? (
              <LanesLayer lanes={editor.lanes} />
            ) : null}
            <Background gap={SNAP_GRID[0]} />
            {/* NOTE: "Ajustar à tela" fica só na barra do editor, sem botão repetido para o leitor de tela. */}
            <Controls showFitView={false} showInteractive={false} />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </EdgeDisplayProvider>
      </IssuesProvider>
    </CanvasActionsProvider>
  );
}

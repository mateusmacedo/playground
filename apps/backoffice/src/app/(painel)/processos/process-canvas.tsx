import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import { type DragEvent, useMemo } from 'react';

import { ariaLabels } from './aria-labels';
import { BLOCK_DRAG_TYPE } from './block-palette';
import { ProcessConnectionLine } from './connection-line';
import { IssuesProvider } from './issues-context';
import { isBlockKind } from './model/blocks';
import { nodeTypes } from './nodes/node-types';
import { blockOrigin, displayEdges, issuesByElement } from './process-graph';
import type { ProcessEditorState } from './use-process-editor';

const SNAP_GRID: [number, number] = [16, 16];

/** O canvas do React Flow ligado ao estado do editor, com o drop dos blocos vindos da biblioteca. */
export function ProcessCanvas({
  editor,
}: Readonly<{ editor: ProcessEditorState }>) {
  const { screenToFlowPosition } = useReactFlow();
  const { graph, issues } = editor;
  const issuesById = useMemo(() => issuesByElement(issues), [issues]);
  const nodes = useMemo(() => [...graph.nodes], [graph.nodes]);
  const edges = useMemo(
    () => displayEdges({ graph, issuesById }),
    [graph, issuesById],
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
    editor.addBlock({ kind, position: blockOrigin(point) });
  }

  return (
    <IssuesProvider value={issuesById}>
      <ReactFlow
        aria-label="Canvas do processo"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={editor.onNodesChange}
        onEdgesChange={editor.onEdgesChange}
        onNodeDragStart={editor.onDragStart}
        onNodeDragStop={editor.onDragStop}
        onSelectionDragStart={editor.onDragStart}
        onSelectionDragStop={editor.onDragStop}
        onConnect={editor.onConnect}
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
        <Background gap={SNAP_GRID[0]} />
        {/* NOTE: "Ajustar à tela" fica só na barra do editor, sem botão repetido para o leitor de tela. */}
        <Controls showFitView={false} showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </IssuesProvider>
  );
}

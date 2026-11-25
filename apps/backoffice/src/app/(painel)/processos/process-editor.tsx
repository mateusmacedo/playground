'use client';

import '@xyflow/react/dist/style.css';

import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useRef } from 'react';

import { BlockPalette } from './block-palette';
import { EditorToolbar } from './editor-toolbar';
import type { BlockKind, Graph, Point } from './model/blocks';
import { ProcessCanvas } from './process-canvas';
import { blockOrigin, type ProcessGraph } from './process-graph';
import { PropertiesPanel } from './properties/properties-panel';
import { useEditorShortcuts } from './use-editor-shortcuts';
import { useProcessEditor } from './use-process-editor';

/** Deslocamento entre inserções seguidas pelo botão, para os blocos novos não caírem um em cima do outro. */
const CASCADE_STEP = 24;
const CASCADE_LENGTH = 5;

export interface ProcessEditorProps {
  readonly initial: Graph;
}

interface CanvasCenterParams {
  readonly canvas: HTMLDivElement;
  readonly toFlow: (point: Point) => Point;
}

/** Centro da área visível do canvas, nas coordenadas do processo. */
function canvasCenter({ canvas, toFlow }: Readonly<CanvasCenterParams>) {
  const rect = canvas.getBoundingClientRect();
  return toFlow({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  });
}

function hasSelectedItem(graph: ProcessGraph): boolean {
  const selectedNode = graph.nodes.some((node) => node.selected);
  const selectedEdge = graph.edges.some((edge) => edge.selected);
  return selectedNode || selectedEdge;
}

function EditorLayout({ initial }: Readonly<ProcessEditorProps>) {
  const editor = useProcessEditor({ initial });
  const { screenToFlowPosition, fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const { graph } = editor;
  useEditorShortcuts({ canvasRef, commands: editor });

  function insertAtCenter(kind: BlockKind) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const center = canvasCenter({ canvas, toFlow: screenToFlowPosition });
    const offset = (graph.nodes.length % CASCADE_LENGTH) * CASCADE_STEP;
    const point = { x: center.x + offset, y: center.y + offset };
    editor.addBlock({ kind, position: blockOrigin(point) });
  }

  return (
    <div className="process-editor">
      <EditorToolbar
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        hasSelection={hasSelectedItem(graph)}
        isEmpty={graph.nodes.length === 0}
        issueCount={editor.issues.length}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onDuplicate={editor.duplicateSelected}
        onDelete={editor.deleteSelected}
        onFitView={() => {
          void fitView();
        }}
        onClear={editor.clear}
      />
      <div className="process-editor__body">
        <div className="process-editor__palette">
          <BlockPalette onAdd={insertAtCenter} />
        </div>
        <div ref={canvasRef} className="process-editor__canvas">
          <ProcessCanvas editor={editor} />
        </div>
        <div className="process-editor__properties">
          <PropertiesPanel
            graph={graph}
            issues={editor.issues}
            commands={editor}
          />
        </div>
      </div>
    </div>
  );
}

/** Editor visual de processos: biblioteca, canvas, propriedades e barra de ações sobre o mesmo estado. */
export function ProcessEditor({ initial }: Readonly<ProcessEditorProps>) {
  return (
    <ReactFlowProvider>
      <EditorLayout initial={initial} />
    </ReactFlowProvider>
  );
}

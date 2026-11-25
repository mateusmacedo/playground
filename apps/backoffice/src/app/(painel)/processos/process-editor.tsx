'use client';

import '@xyflow/react/dist/style.css';

import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useRef } from 'react';

import { BlockPalette } from './block-palette';
import { EditorDialogs, useEditorDialogs } from './editor-dialogs';
import { EditorToolbar } from './editor-toolbar';
import type { BlockKind, Graph, Point } from './model/blocks';
import { countIssues } from './model/issues';
import { ProcessCanvas } from './process-canvas';
import { blockOrigin, type ProcessGraph } from './process-graph';
import { ProcessSearch } from './process-search';
import { LanesEditor } from './properties/lanes-editor';
import { PropertiesPanel } from './properties/properties-panel';
import { SubprocessBreadcrumb } from './subprocess-breadcrumb';
import { useEditorFocus } from './use-editor-focus';
import { useEditorShortcuts } from './use-editor-shortcuts';
import {
  type ProcessEditorState,
  useProcessEditor,
} from './use-process-editor';

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

interface EditorSidebarProps {
  readonly editor: ProcessEditorState;
  readonly onFocusNode: (nodeId: string) => void;
  readonly onInsert: (kind: BlockKind) => void;
}

/** Coluna da esquerda: busca, biblioteca e, no processo principal, as raias. */
function EditorSidebar({
  editor,
  onFocusNode,
  onInsert,
}: Readonly<EditorSidebarProps>) {
  return (
    <div className="process-editor__palette">
      <ProcessSearch graph={editor.graph} onSelect={onFocusNode} />
      <BlockPalette onAdd={onInsert} />
      {editor.path.length === 0 ? (
        <LanesEditor lanes={editor.lanes} commands={editor} />
      ) : null}
    </div>
  );
}

function EditorLayout({ initial }: Readonly<ProcessEditorProps>) {
  const editor = useProcessEditor({ initial });
  const { screenToFlowPosition, fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dialogs = useEditorDialogs();
  const { graph } = editor;
  const focus = useEditorFocus({ graph, selectOnly: editor.selectOnly });
  const commands = {
    ...editor,
    focusIssue: focus.focusIssue,
    requestInsertOnEdge: (edgeId: string) =>
      dialogs.requestPick({ purpose: 'edge', edgeId }),
  };
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
        selectedNodes={graph.nodes.filter((node) => node.selected).length}
        isEmpty={graph.nodes.length === 0}
        issueCount={countIssues(editor.issues)}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onDuplicate={editor.duplicateSelected}
        onDelete={editor.deleteSelected}
        onAlign={editor.align}
        onDistribute={editor.distribute}
        onAutoLayout={editor.autoLayout}
        onFitView={() => {
          void fitView({ maxZoom: 1.2 });
        }}
        onClear={dialogs.askClear}
      />
      <div className="process-editor__body">
        <EditorSidebar
          editor={editor}
          onFocusNode={focus.focusNode}
          onInsert={insertAtCenter}
        />
        <div className="process-editor__stage">
          <SubprocessBreadcrumb
            crumbs={editor.crumbs}
            onOpenLevel={editor.openLevel}
          />
          <div ref={canvasRef} className="process-editor__canvas">
            <ProcessCanvas
              editor={editor}
              onRequestPick={dialogs.requestPick}
            />
          </div>
        </div>
        <div className="process-editor__properties">
          <PropertiesPanel
            graph={graph}
            lanes={editor.path.length === 0 ? editor.lanes : []}
            issues={editor.issues}
            commands={commands}
          />
        </div>
      </div>
      <EditorDialogs editor={editor} dialogs={dialogs} />
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

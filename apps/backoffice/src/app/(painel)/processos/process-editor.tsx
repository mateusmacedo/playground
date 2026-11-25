'use client';

import '@xyflow/react/dist/style.css';

import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useEffect, useEffectEvent, useRef } from 'react';

import { BlockPalette } from './block-palette';
import { EditorToolbar } from './editor-toolbar';
import type { BlockKind, Graph } from './model/blocks';
import { ProcessCanvas } from './process-canvas';
import { blockOrigin } from './process-graph';
import { PropertiesPanel } from './properties/properties-panel';
import { isEditableTarget, shortcutFor } from './shortcuts';
import { useProcessEditor } from './use-process-editor';

/** Deslocamento entre inserções seguidas pelo botão, para os blocos novos não caírem um em cima do outro. */
const CASCADE_STEP = 24;
const CASCADE_LENGTH = 5;

function EditorLayout({ initial }: Readonly<{ initial: Graph }>) {
  const editor = useProcessEditor({ initial });
  const { screenToFlowPosition, fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const { graph } = editor;
  const hasSelection =
    graph.nodes.some((node) => node.selected) ||
    graph.edges.some((edge) => edge.selected);

  const runShortcut = useEffectEvent((event: KeyboardEvent) => {
    const shortcut = shortcutFor(event);
    if (!shortcut || isEditableTarget(event.target)) {
      return;
    }
    // NOTE: Delete e Backspace só apagam a seleção com o foco no canvas ou em lugar nenhum, para não surpreender
    // quem está num botão da barra ou do painel.
    const inCanvas =
      event.target === document.body ||
      (event.target instanceof Node &&
        canvasRef.current?.contains(event.target) === true);
    if (shortcut === 'delete' && !inCanvas) {
      return;
    }
    event.preventDefault();
    const actions = {
      undo: editor.undo,
      redo: editor.redo,
      duplicate: editor.duplicateSelected,
      delete: editor.deleteSelected,
    };
    actions[shortcut]();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => runShortcut(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  function insertAtCenter(kind: BlockKind) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const center = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    const offset = (graph.nodes.length % CASCADE_LENGTH) * CASCADE_STEP;
    editor.addBlock({
      kind,
      position: blockOrigin({ x: center.x + offset, y: center.y + offset }),
    });
  }

  return (
    <div className="process-editor">
      <EditorToolbar
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        hasSelection={hasSelection}
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
export function ProcessEditor({ initial }: Readonly<{ initial: Graph }>) {
  return (
    <ReactFlowProvider>
      <EditorLayout initial={initial} />
    </ReactFlowProvider>
  );
}

'use client';

import '@xyflow/react/dist/style.css';

import { CAlert } from '@coreui/react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { type Ref, useImperativeHandle, useRef, useState } from 'react';

import { useIsClient } from '@/shared/hooks/use-is-client';

import { BlockPalette } from './block-palette';
import { createBrowserDraftStore, type DraftStore } from './draft-store';
import {
  EditorDialogs,
  type EditorDialogsState,
  useEditorDialogs,
} from './editor-dialogs';
import { EditorDraftBar } from './editor-draft-bar';
import { type EditorOpening, openEditor } from './editor-opening';
import { EditorToolbar } from './editor-toolbar';
import { cascadeOffset } from './insert-cascade';
import type { BlockKind, Graph, Point } from './model/blocks';
import { countIssues } from './model/issues';
import { ProcessCanvas } from './process-canvas';
import { blockOrigin, type ProcessGraph } from './process-graph';
import { ProcessSearch } from './process-search';
import { LanesEditor } from './properties/lanes-editor';
import { PropertiesPanel } from './properties/properties-panel';
import type { EditorPublication } from './publication';
import { SubprocessBreadcrumb } from './subprocess-breadcrumb';
import { useDraft } from './use-draft';
import { useEditorFocus } from './use-editor-focus';
import { useEditorShortcuts } from './use-editor-shortcuts';
import {
  type ProcessEditorState,
  useProcessEditor,
} from './use-process-editor';

/** O que a tela em volta do editor precisa saber antes de trocar de processo. */
export interface EditorGuard {
  readonly hasChanges: boolean;
  /** Grava o rascunho; devolve `true` quando a gravação deu certo. */
  readonly save: () => Promise<boolean>;
}

export interface ProcessEditorProps {
  /** Processo de exemplo, aberto quando não há rascunho salvo. */
  readonly initial: Graph;
  /** Onde o rascunho é guardado; por padrão, o `localStorage` do navegador. */
  readonly store?: DraftStore;
  /** Publicação do processo do catálogo; sem ela, o editor só salva o rascunho. */
  readonly publication?: EditorPublication;
  /** Recebe o estado do rascunho, para a tela confirmar a troca de processo com alteração não salva. */
  readonly guardRef?: Ref<EditorGuard>;
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

interface EditorTopProps {
  readonly editor: ProcessEditorState;
  readonly dialogs: EditorDialogsState;
  readonly onFitView: () => void;
}

/** Barra de ações e o resumo da validação, acima do editor. */
function EditorTop({ editor, dialogs, onFitView }: Readonly<EditorTopProps>) {
  const { graph } = editor;
  return (
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
      onFitView={onFitView}
      onClear={dialogs.askClear}
    />
  );
}

interface EditorLayoutProps
  extends Pick<ProcessEditorProps, 'publication' | 'guardRef'> {
  readonly opening: EditorOpening;
  readonly store: DraftStore;
}

function EditorLayout({
  opening,
  store,
  publication,
  guardRef,
}: Readonly<EditorLayoutProps>) {
  const editor = useProcessEditor({
    initial: opening.graph,
    lanes: opening.lanes,
  });
  const draft = useDraft({
    document: editor.document,
    store,
    restored: opening.restored,
  });
  useImperativeHandle(
    guardRef,
    () => ({ hasChanges: draft.hasChanges, save: draft.save }),
    [draft.hasChanges, draft.save],
  );
  const { screenToFlowPosition, fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  /** Inserções pelo `+` desde que o editor abriu, para a cascata não depender de quantos blocos existem. */
  const insertions = useRef(0);
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
    const offset = cascadeOffset(insertions.current);
    insertions.current += 1;
    const point = { x: center.x + offset, y: center.y + offset };
    editor.addBlock({ kind, position: blockOrigin(point) });
  }

  return (
    <div className="process-editor">
      {opening.unreadable ? (
        <CAlert color="warning" dismissible className="py-2 small">
          O rascunho salvo não pôde ser lido; o exemplo foi aberto no lugar.
        </CAlert>
      ) : null}
      {opening.adjusted > 0 ? (
        <CAlert color="info" dismissible className="py-2 small">
          {`O rascunho tinha ${opening.adjusted} valor(es) fora do formato atual, que foram convertidos ou removidos. Confira os blocos e salve de novo.`}
        </CAlert>
      ) : null}
      <EditorDraftBar
        document={editor.document}
        draft={draft}
        publication={publication}
      />
      <EditorTop
        editor={editor}
        dialogs={dialogs}
        onFitView={() => {
          void fitView({ maxZoom: 1.2 });
        }}
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
          {editor.refusal ? (
            <CAlert
              color="danger"
              dismissible
              onClose={editor.dismissRefusal}
              className="py-2 small mb-2"
            >
              {editor.refusal}
            </CAlert>
          ) : null}
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

interface OpenedEditorProps extends Omit<ProcessEditorProps, 'store'> {
  readonly store: DraftStore;
}

/** Editor visual de processos: biblioteca, canvas, propriedades e barra de ações sobre o mesmo estado. */
function OpenedEditor({
  initial,
  store,
  publication,
  guardRef,
}: Readonly<OpenedEditorProps>) {
  // NOTE: lido uma vez, na montagem; depois disso o rascunho só muda quando o usuário salva.
  const [opening] = useState(() => openEditor({ store, sample: initial }));
  return (
    <ReactFlowProvider>
      <EditorLayout
        opening={opening}
        store={store}
        publication={publication}
        guardRef={guardRef}
      />
    </ReactFlowProvider>
  );
}

/**
 * Editor visual de processos. O rascunho mora no navegador, então o editor só monta no cliente: o servidor e a
 * hidratação mostram o aviso de carregamento, e o HTML dos dois lados é o mesmo.
 */
export function ProcessEditor({
  store,
  ...props
}: Readonly<ProcessEditorProps>) {
  const isClient = useIsClient();
  const [browserStore] = useState(() => store ?? createBrowserDraftStore());
  if (!isClient) {
    return (
      <p role="status" className="small text-body-secondary">
        Carregando o editor…
      </p>
    );
  }
  return <OpenedEditor store={browserStore} {...props} />;
}

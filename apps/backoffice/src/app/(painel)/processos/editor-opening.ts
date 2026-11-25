import type { DraftStore } from './draft-store';
import type { Graph } from './model/blocks';
import type { Lane } from './model/document';
import { parseDocument } from './model/draft';

/** Com o que o editor abre: o rascunho salvo ou, sem ele, o exemplo. */
export interface EditorOpening {
  readonly graph: Graph;
  readonly lanes: readonly Lane[];
  readonly restored: boolean;
  /** Havia rascunho, mas ele não pôde ser lido; a tela avisa e abre o exemplo. */
  readonly unreadable: boolean;
}

export interface OpenEditorParams {
  readonly store: DraftStore;
  readonly sample: Graph;
}

export function openEditor({ store, sample }: OpenEditorParams): EditorOpening {
  const text = store.load();
  if (text === null) {
    return { graph: sample, lanes: [], restored: false, unreadable: false };
  }
  const document = parseDocument(text);
  if (document === null) {
    return { graph: sample, lanes: [], restored: false, unreadable: true };
  }
  return {
    graph: document.graph,
    lanes: document.lanes,
    restored: true,
    unreadable: false,
  };
}

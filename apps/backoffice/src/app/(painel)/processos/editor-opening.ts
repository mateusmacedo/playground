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
  /** Campos do rascunho que estavam fora da regra e foram convertidos ou removidos na abertura. */
  readonly adjusted: number;
}

export interface OpenEditorParams {
  readonly store: DraftStore;
  readonly sample: Graph;
}

export function openEditor({ store, sample }: OpenEditorParams): EditorOpening {
  const text = store.load();
  if (text === null) {
    return {
      graph: sample,
      lanes: [],
      restored: false,
      unreadable: false,
      adjusted: 0,
    };
  }
  const reading = parseDocument(text);
  if (reading === null) {
    return {
      graph: sample,
      lanes: [],
      restored: false,
      unreadable: true,
      adjusted: 0,
    };
  }
  return {
    graph: reading.document.graph,
    lanes: reading.document.lanes,
    restored: reading.adjusted === 0,
    unreadable: false,
    adjusted: reading.adjusted,
  };
}

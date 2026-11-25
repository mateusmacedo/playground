import type { DraftStore } from './draft-store';
import { openEditor } from './editor-opening';
import { serializeDocument } from './model/draft';
import { sampleProcess } from './model/sample-process';

function storeWith(text: string | null): DraftStore {
  return { load: () => text, save: async () => undefined };
}

describe('openEditor', () => {
  it('abre o exemplo quando não há rascunho', () => {
    expect(
      openEditor({ store: storeWith(null), sample: sampleProcess }),
    ).toEqual({
      graph: sampleProcess,
      lanes: [],
      restored: false,
      unreadable: false,
    });
  });

  it('retoma o rascunho salvo', () => {
    const text = serializeDocument({
      version: 1,
      lanes: [{ id: 'a', name: 'A', width: 256 }],
      graph: { nodes: [], edges: [] },
    });

    const opening = openEditor({
      store: storeWith(text),
      sample: sampleProcess,
    });

    expect(opening.restored).toBe(true);
    expect(opening.lanes).toHaveLength(1);
    expect(opening.graph.nodes).toEqual([]);
  });

  it('abre o exemplo e avisa quando o rascunho não pode ser lido', () => {
    const opening = openEditor({
      store: storeWith('{'),
      sample: sampleProcess,
    });

    expect(opening.unreadable).toBe(true);
    expect(opening.graph).toBe(sampleProcess);
  });
});

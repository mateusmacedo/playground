import type { Graph } from './blocks';
import { searchProcess } from './search';
import { block, decisionBranches } from './test-graph';

const graph: Graph = {
  nodes: [
    block({
      id: 'review',
      type: 'human-task',
      data: { label: 'Analisar', role: 'Jurídico' },
    }),
    block({
      id: 'decision',
      type: 'decision',
      data: { label: 'Aprovado?', branches: decisionBranches },
    }),
    block({ id: 'note', type: 'annotation', data: { label: '' } }),
  ],
  edges: [],
};

describe('searchProcess', () => {
  it('acha pelo nome do bloco sem diferenciar maiúscula nem acento', () => {
    expect(searchProcess({ graph, query: 'analis' })).toEqual([
      { nodeId: 'review', name: 'Analisar', detail: 'Tarefa humana' },
    ]);
  });

  it('acha pelo nome do ramo e pelo responsável', () => {
    expect(searchProcess({ graph, query: 'nao' })).toEqual([
      { nodeId: 'decision', name: 'Aprovado?', detail: 'Ramo Não' },
    ]);
    expect(searchProcess({ graph, query: 'jurid' })).toEqual([
      { nodeId: 'review', name: 'Analisar', detail: 'Responsável: Jurídico' },
    ]);
  });

  it('não devolve nada com a busca vazia', () => {
    expect(searchProcess({ graph, query: '   ' })).toEqual([]);
  });
});

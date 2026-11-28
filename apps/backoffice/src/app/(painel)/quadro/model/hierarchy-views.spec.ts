import type { BoardLane } from './board';
import {
  cardMatchesHierarchy,
  HIERARCHY_FILTERS,
  type HierarchyFilter,
  hierarchyIndex,
  type TreeRow,
  treeRows,
} from './hierarchy-views';
import { listRows, sortRows } from './views';

// a > b > c e a > d; e é solto; o tem um pai que não está nas colunas.
const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'a', title: 'A' },
      { id: 'c', title: 'C', parentId: 'b' },
      { id: 'e', title: 'E' },
      { id: 'o', title: 'O', parentId: 'sumiu' },
    ],
  },
  {
    id: 'doing',
    title: 'Em andamento',
    cards: [
      { id: 'd', title: 'D', parentId: 'a' },
      { id: 'b', title: 'B', parentId: 'a' },
    ],
  },
];

const rows = listRows({ lanes, people: new Map() });

function matching(filter: HierarchyFilter): readonly string[] {
  const index = hierarchyIndex(lanes);
  return rows
    .map((row) => row.card)
    .filter((card) => cardMatchesHierarchy({ card, filter, index }))
    .map((card) => card.id);
}

function shape(tree: readonly TreeRow[]) {
  return tree.map(
    (item) =>
      `${'-'.repeat(item.depth)}${item.row.card.id}${item.hasChildren ? '+' : ''}${item.collapsed ? '!' : ''}`,
  );
}

describe('filtro de hierarquia', () => {
  it('oferece as quatro opções na ordem da barra', () => {
    expect(HIERARCHY_FILTERS.map((option) => option.value)).toEqual([
      'all',
      'parents',
      'children',
      'top',
    ]);
  });

  it('separa pais, filhos e cards de topo', () => {
    expect(matching('all')).toEqual(['a', 'c', 'e', 'o', 'd', 'b']);
    expect(matching('parents')).toEqual(['a', 'b']);
    expect(matching('children')).toEqual(['c', 'd', 'b']);
    expect(matching('top')).toEqual(['a', 'e', 'o']);
  });
});

describe('treeRows', () => {
  it('põe cada filho abaixo do pai, com o nível, mantendo a ordem de cada nível', () => {
    const tree = treeRows({ rows, collapsed: new Set() });
    expect(shape(tree)).toEqual(['a+', '-d', '-b+', '--c', 'e', 'o']);
  });

  it('segue a ordenação das linhas dentro de cada nível', () => {
    const sorted = sortRows({
      rows,
      sort: { key: 'title', direction: 'descending' },
    });
    const tree = treeRows({ rows: sorted, collapsed: new Set() });
    expect(shape(tree)).toEqual(['o', 'e', 'a+', '-d', '-b+', '--c']);
  });

  it('esconde as descendentes do card recolhido', () => {
    const tree = treeRows({ rows, collapsed: new Set(['a']) });
    expect(shape(tree)).toEqual(['a+!', 'e', 'o']);
  });

  it('leva ao topo quem tem o pai fora das linhas', () => {
    const filtered = rows.filter((row) => row.card.id !== 'a');
    const tree = treeRows({ rows: filtered, collapsed: new Set() });
    expect(shape(tree)).toEqual(['e', 'o', 'd', 'b+', '-c']);
  });

  it('não perde os cards de um ciclo de pais', () => {
    const cycle: readonly BoardLane[] = [
      {
        id: 'todo',
        title: 'A fazer',
        cards: [
          { id: 'x', title: 'X', parentId: 'y' },
          { id: 'y', title: 'Y', parentId: 'x' },
        ],
      },
    ];
    const cycleRows = listRows({ lanes: cycle, people: new Map() });
    const tree = treeRows({ rows: cycleRows, collapsed: new Set() });
    expect(shape(tree)).toEqual(['x+', '-y+']);
  });
});

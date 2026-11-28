import { listTree } from './list-tree';
import type { BoardLane } from './model/board';
import { type ListRow, listRows } from './model/views';

// Pai > Filho > Neto, e Solto.
const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'neto', title: 'Neto', parentId: 'filho' },
      { id: 'solto', title: 'Solto' },
      { id: 'filho', title: 'Filho', parentId: 'pai' },
      { id: 'pai', title: 'Pai' },
    ],
  },
];

const rows: readonly ListRow[] = listRows({ lanes, people: new Map() });

function ids(list: readonly ListRow[]): string[] {
  return list.map((row) => row.card.id);
}

describe('listTree', () => {
  it('põe cada card abaixo do pai, com o nível e os filhos de cada linha', () => {
    const tree = listTree({ rows, collapsedRows: [], onChange: vi.fn() });

    expect(ids(tree.rows)).toEqual(['solto', 'pai', 'filho', 'neto']);
    expect(tree.nodes.get('pai')).toMatchObject({
      depth: 0,
      hasChildren: true,
      collapsed: false,
    });
    expect(tree.nodes.get('neto')).toMatchObject({
      depth: 2,
      hasChildren: false,
    });
  });

  it('esconde os descendentes do card recolhido', () => {
    const tree = listTree({ rows, collapsedRows: ['pai'], onChange: vi.fn() });

    expect(ids(tree.rows)).toEqual(['solto', 'pai']);
    expect(tree.nodes.get('pai')?.collapsed).toBe(true);
    expect(tree.nodes.has('filho')).toBe(false);
  });

  it('recolhe o card expandido e expande o recolhido', () => {
    const onChange = vi.fn();
    const tree = listTree({ rows, collapsedRows: ['pai'], onChange });

    tree.toggle('filho');
    tree.toggle('pai');

    expect(onChange).toHaveBeenNthCalledWith(1, ['pai', 'filho']);
    expect(onChange).toHaveBeenNthCalledWith(2, []);
  });
});

import type { BoardLane } from './board';
import { groupByParent, listRows, sortRows } from './views';

const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'p', title: 'Pai', number: 1 },
      {
        id: 'a',
        title: 'beta',
        parentId: 'p',
        number: 3,
        dueDate: '2026-02-01',
      },
      { id: 's', title: 'Solto', number: 5 },
    ],
  },
  {
    id: 'done',
    title: 'Feito',
    cards: [
      { id: 'b', title: 'Álvaro', parentId: 'p', number: 2, assigneeId: 'x' },
      { id: 'q', title: 'Outro pai', number: 4 },
    ],
  },
  {
    id: 'hidden',
    title: 'Oculta',
    hidden: true,
    cards: [{ id: 'h', title: 'Pai oculto', number: 6 }],
  },
];

const shown = lanes.filter((lane) => !lane.hidden);

describe('linhas por card pai', () => {
  it('faz uma linha por pai com filhos e a dos cards sem pai no fim', () => {
    const groups = groupByParent({ lanes: shown, allLanes: lanes });
    expect(groups.map((group) => group.parent?.id ?? null)).toEqual([
      'p',
      null,
    ]);
    expect(
      groups[0]?.cells.map((cell) => cell.cards.map((card) => card.id)),
    ).toEqual([['a'], ['b']]);
    expect(
      groups[1]?.cells.map((cell) => cell.cards.map((card) => card.id)),
    ).toEqual([['p', 's'], ['q']]);
  });

  it('acha o pai numa coluna oculta e omite a linha sem pai vazia', () => {
    const withHiddenParent: readonly BoardLane[] = [
      { id: 'a', title: 'A', cards: [{ id: 'c', title: 'C', parentId: 'h' }] },
      {
        id: 'o',
        title: 'Oculta',
        hidden: true,
        cards: [{ id: 'h', title: 'Pai oculto' }],
      },
    ];
    const groups = groupByParent({
      lanes: withHiddenParent.slice(0, 1),
      allLanes: withHiddenParent,
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.parent?.title).toBe('Pai oculto');
  });
});

describe('visão em lista', () => {
  const people = new Map([['x', 'Bruno']]);
  const rows = listRows({ lanes: shown, people });

  it('monta uma linha por card, na ordem do quadro', () => {
    expect(rows.map((row) => row.card.id)).toEqual(['p', 'a', 's', 'b', 'q']);
    expect(rows[3]).toMatchObject({ assignee: 'Bruno', laneIndex: 1 });
  });

  it('ordena por cada coluna e desempata pela ordem do quadro', () => {
    const ids = (
      key: Parameters<typeof sortRows>[0]['sort']['key'],
      descending = false,
    ) =>
      sortRows({
        rows,
        sort: { key, direction: descending ? 'descending' : 'ascending' },
      }).map((row) => row.card.id);

    expect(ids('key')).toEqual(['p', 'b', 'a', 'q', 's']);
    expect(ids('key', true)).toEqual(['s', 'q', 'a', 'b', 'p']);
    expect(ids('title')).toEqual(['b', 'a', 'q', 'p', 's']);
    expect(ids('lane', true)).toEqual(['b', 'q', 'p', 'a', 's']);
    expect(ids('assignee')).toEqual(['b', 'p', 'a', 's', 'q']);
    expect(ids('assignee', true)).toEqual(['b', 'p', 'a', 's', 'q']);
    expect(ids('due')).toEqual(['a', 'p', 's', 'b', 'q']);
  });
});

import {
  ACTIVITY_LIMIT,
  activityText,
  appendActivity,
  withActivity,
} from './activity';
import { archiveCard, restoreArchived } from './archive';
import type { Board, BoardCard, CardActivity } from './board';
import { createBoard } from './board-state';

const at = '2026-11-24T10:00:00Z';

const board: Board = createBoard({
  lanes: [
    {
      id: 'todo',
      title: 'A fazer',
      cards: [
        { id: 'p', title: 'Pai' },
        { id: 'x', title: 'X', labelIds: ['l1'] },
      ],
    },
    { id: 'doing', title: 'Em andamento', cards: [] },
  ],
  labels: [
    { id: 'l1', name: 'Urgente', color: 'danger' },
    { id: 'l2', name: 'Ideia', color: 'info' },
  ],
});

function change(update: (card: BoardCard) => BoardCard): Board {
  return {
    ...board,
    lanes: board.lanes.map((lane) => ({
      ...lane,
      cards: lane.cards.map((card) => (card.id === 'x' ? update(card) : card)),
    })),
  };
}

function activityOf(state: Board, id = 'x'): readonly CardActivity[] {
  const live = state.lanes.flatMap((lane) => lane.cards);
  const archived = state.archive.flatMap((entry) =>
    entry.cards.map((item) => item.card),
  );
  return [...live, ...archived].find((card) => card.id === id)?.activity ?? [];
}

const texts = (state: Board, id = 'x') =>
  activityOf(state, id).map(activityText);

describe('withActivity', () => {
  it('registra cada tipo de mudança do card', () => {
    const after = change((card) => ({
      ...card,
      title: 'Novo X',
      description: 'Texto',
      parentId: 'p',
      labelIds: ['l2'],
      dueDate: '2026-11-28',
      checklist: [{ id: 'i', text: 'Passo', done: true }],
    }));
    expect(
      texts(withActivity({ before: board, after, at, merge: false })),
    ).toEqual([
      'Título alterado de "X" para "Novo X".',
      'Descrição alterada.',
      'Ligado ao card pai Pai.',
      'Etiqueta incluída: Ideia. Etiqueta removida: Urgente.',
      'Prazo definido para 28/11/2026.',
      'Checklist com 1 de 1 itens feitos.',
    ]);
  });

  it('registra criação, movimento, arquivamento e restauração', () => {
    const created = {
      ...board,
      lanes: board.lanes.map((lane) =>
        lane.id === 'doing'
          ? { ...lane, cards: [{ id: 'n', title: 'Novo', number: 9 }] }
          : lane,
      ),
    };
    expect(
      texts(
        withActivity({ before: board, after: created, at, merge: false }),
        'n',
      ),
    ).toEqual(['Criado em Em andamento.']);

    const moved = {
      ...board,
      lanes: [
        { ...board.lanes[0], cards: [board.lanes[0]?.cards[0]] },
        { ...board.lanes[1], cards: [board.lanes[0]?.cards[1]] },
      ],
    } as Board;
    expect(
      texts(withActivity({ before: board, after: moved, at, merge: false })),
    ).toEqual(['Movido de A fazer para Em andamento.']);

    const archived = withActivity({
      before: board,
      after: archiveCard({ board, cardId: 'x', at }),
      at,
      merge: false,
    });
    expect(texts(archived)).toEqual(['Arquivado.']);
    const restored = withActivity({
      before: archived,
      after: restoreArchived({ board: archived, entryId: 'x' }),
      at,
      merge: false,
    });
    expect(texts(restored)).toEqual(['Arquivado.', 'Restaurado em A fazer.']);
  });

  it('não registra nada para card sem mudança, cópia já com histórico ou card excluído', () => {
    expect(
      withActivity({ before: board, after: board, at, merge: false }),
    ).toBe(board);
    const renamedLane = {
      ...board,
      lanes: board.lanes.map((lane) => ({ ...lane })),
    };
    expect(
      withActivity({ before: board, after: renamedLane, at, merge: false }),
    ).toBe(renamedLane);
    const copy = {
      ...board,
      lanes: board.lanes.map((lane) =>
        lane.id === 'doing'
          ? {
              ...lane,
              cards: [
                {
                  id: 'c',
                  title: 'C',
                  number: 9,
                  activity: [{ at, kind: 'duplicated' as const, from: 'QD-2' }],
                },
              ],
            }
          : { ...lane, cards: lane.cards.filter((card) => card.id !== 'x') },
      ),
    };
    expect(
      texts(
        withActivity({ before: board, after: copy, at, merge: false }),
        'c',
      ),
    ).toEqual(['Duplicado de QD-2.']);
  });

  it('registra prazo cumprido, prazo retirado, pai trocado e desligado', () => {
    const withDue = change((card) => ({
      ...card,
      dueDate: '2026-11-28',
      parentId: 'p',
    }));
    const done = {
      ...withDue,
      lanes: withDue.lanes.map((lane) => ({
        ...lane,
        cards: lane.cards.map((card) =>
          card.id === 'x' ? { ...card, dueDone: true } : card,
        ),
      })),
    };
    expect(
      activityText(
        withActivity({ before: withDue, after: done, at, merge: false })
          .lanes[0]?.cards[1]?.activity?.[0] as CardActivity,
      ),
    ).toBe('Prazo marcado como cumprido.');
    expect(
      texts(withActivity({ before: withDue, after: board, at, merge: false })),
    ).toEqual(['Desligado do card pai Pai.', 'Prazo retirado.']);
  });
});

describe('appendActivity', () => {
  const moved = (from: string, to: string): CardActivity => ({
    at,
    kind: 'moved',
    from,
    to,
  });

  it('junta registros do mesmo tipo e apaga o que volta ao ponto de partida', () => {
    let list = appendActivity({
      list: [],
      entries: [moved('A', 'B')],
      merge: false,
    });
    list = appendActivity({ list, entries: [moved('B', 'C')], merge: true });
    expect(list).toEqual([moved('A', 'C')]);
    list = appendActivity({ list, entries: [moved('C', 'A')], merge: true });
    expect(list).toEqual([]);

    const renamed = appendActivity({
      list: [{ at, kind: 'renamed', from: 'X', to: 'Xa' }],
      entries: [{ at, kind: 'renamed', from: 'Xa', to: 'Xab' }],
      merge: true,
    });
    expect(renamed).toEqual([{ at, kind: 'renamed', from: 'X', to: 'Xab' }]);

    const parent = appendActivity({
      list: [{ at, kind: 'parent', to: 'P' }],
      entries: [{ at, kind: 'parent', from: 'P', to: 'Q' }],
      merge: true,
    });
    expect(parent).toEqual([{ at, kind: 'parent', to: 'Q' }]);

    const description = appendActivity({
      list: [{ at: 'antes', kind: 'description' }],
      entries: [{ at, kind: 'description' }],
      merge: true,
    });
    expect(description).toEqual([{ at, kind: 'description' }]);
  });

  it(`guarda no máximo ${ACTIVITY_LIMIT} registros`, () => {
    const many = Array.from({ length: ACTIVITY_LIMIT + 3 }, () =>
      moved('A', 'B'),
    );
    expect(
      appendActivity({ list: [], entries: many, merge: false }),
    ).toHaveLength(ACTIVITY_LIMIT);
  });
});

describe('activityText', () => {
  it('descreve os registros que os outros testes não cobrem', () => {
    expect(activityText({ at, kind: 'parent', from: 'P', to: 'Q' })).toBe(
      'Card pai trocado de P para Q.',
    );
    expect(activityText({ at, kind: 'parent' })).toBe('Desligado do card pai.');
    expect(
      activityText({ at, kind: 'labels', added: ['A', 'B'], removed: [] }),
    ).toBe('Etiquetas incluídas: A, B.');
    expect(
      activityText({ at, kind: 'labels', added: [], removed: ['A', 'B'] }),
    ).toBe('Etiquetas removidas: A, B.');
    expect(activityText({ at, kind: 'due-done', done: false })).toBe(
      'Prazo marcado como não cumprido.',
    );
    expect(activityText({ at, kind: 'checklist', done: 0, total: 0 })).toBe(
      'Checklist esvaziado.',
    );
  });
});

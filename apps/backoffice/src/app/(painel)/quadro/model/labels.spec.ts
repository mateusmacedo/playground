import type { Board } from './board';
import { createBoard } from './board-state';
import {
  cardLabels,
  createLabel,
  nextLabelId,
  removeLabel,
  toggleCardLabel,
  updateLabel,
} from './labels';
import { cardMatchesLabels, cardMatchesQuery, normalizeText } from './search';

const board: Board = createBoard({
  lanes: [
    {
      id: 'a',
      title: 'A',
      cards: [
        { id: 'x', title: 'Revisão do contrato', labelIds: ['l1'] },
        { id: 'y', title: 'Outro', description: 'Ação pendente' },
      ],
    },
  ],
  labels: [{ id: 'l1', name: 'Urgente', color: 'danger' }],
  archive: [
    {
      id: 'z',
      archivedAt: 'agora',
      cards: [{ laneId: 'a', card: { id: 'z', title: 'Z', labelIds: ['l1'] } }],
    },
  ],
});

const cardOf = (state: Board, index: number) => state.lanes[0]?.cards[index];

describe('etiquetas', () => {
  it('cria a etiqueta e já põe no card, sem repetir nome', () => {
    const id = nextLabelId(board.labels);
    expect(id).toBe('label-1');
    const next = createLabel({
      board,
      label: { id, name: ' Ideia ', color: 'info' },
      cardId: 'y',
    });
    expect(next.labels.at(-1)).toEqual({ id, name: 'Ideia', color: 'info' });
    expect(cardOf(next, 1)?.labelIds).toEqual([id]);
    expect(
      createLabel({ board, label: { id, name: 'urgente', color: 'info' } }),
    ).toBe(board);
    expect(
      createLabel({ board, label: { id, name: ' ', color: 'info' } }),
    ).toBe(board);
  });

  it('põe e tira a etiqueta do card', () => {
    const off = toggleCardLabel({
      lanes: board.lanes,
      cardId: 'x',
      labelId: 'l1',
    });
    expect(off[0]?.cards[0]?.labelIds).toBeUndefined();
    const on = toggleCardLabel({ lanes: off, cardId: 'x', labelId: 'l1' });
    expect(on[0]?.cards[0]?.labelIds).toEqual(['l1']);
  });

  it('renomeia e troca a cor, mantendo o nome quando ele é vazio ou repetido', () => {
    const renamed = updateLabel({
      board,
      labelId: 'l1',
      patch: { name: 'Crítica', color: 'warning' },
    });
    expect(renamed.labels[0]).toEqual({
      id: 'l1',
      name: 'Crítica',
      color: 'warning',
    });
    const withTwo = createLabel({
      board,
      label: { id: 'l2', name: 'Ideia', color: 'info' },
    });
    expect(
      updateLabel({
        board: withTwo,
        labelId: 'l2',
        patch: { name: 'URGENTE' },
      }),
    ).toBe(withTwo);
    expect(updateLabel({ board, labelId: 'l1', patch: { name: '' } })).toBe(
      board,
    );
    expect(updateLabel({ board, labelId: 'nada', patch: { name: 'X' } })).toBe(
      board,
    );
  });

  it('exclui a etiqueta do catálogo e dos cards, inclusive os arquivados', () => {
    const next = removeLabel({ board, labelId: 'l1' });
    expect(next.labels).toEqual([]);
    expect(cardOf(next, 0)?.labelIds).toBeUndefined();
    expect(next.archive[0]?.cards[0]?.card.labelIds).toBeUndefined();
    expect(removeLabel({ board, labelId: 'nada' })).toBe(board);
  });

  it('lista as etiquetas do card na ordem do catálogo', () => {
    const card = cardOf(board, 0);
    expect(
      card && cardLabels({ card, labels: board.labels }).map((l) => l.name),
    ).toEqual(['Urgente']);
  });
});

describe('busca', () => {
  it('compara sem maiúsculas nem acentos', () => {
    expect(normalizeText('Ação ÉPICA')).toBe('acao epica');
  });

  it('procura cada palavra no título, descrição, código, etiquetas e checklist', () => {
    const [x, y] = board.lanes[0]?.cards ?? [];
    const labels = board.labels;
    if (!x || !y) {
      throw new Error('cards de teste ausentes');
    }
    expect(cardMatchesQuery({ card: x, query: '', labels })).toBe(true);
    expect(
      cardMatchesQuery({ card: x, query: 'revisao contrato', labels }),
    ).toBe(true);
    expect(cardMatchesQuery({ card: x, query: 'urgente', labels })).toBe(true);
    expect(cardMatchesQuery({ card: x, query: 'qd-1', labels })).toBe(true);
    expect(cardMatchesQuery({ card: y, query: 'acao', labels })).toBe(true);
    expect(cardMatchesQuery({ card: y, query: 'contrato', labels })).toBe(
      false,
    );
    expect(
      cardMatchesQuery({
        card: { ...y, checklist: [{ id: 'i', text: 'Ligar', done: false }] },
        query: 'ligar',
        labels,
      }),
    ).toBe(true);
  });

  it('filtra por qualquer uma das etiquetas escolhidas', () => {
    const [x, y] = board.lanes[0]?.cards ?? [];
    if (!x || !y) {
      throw new Error('cards de teste ausentes');
    }
    expect(cardMatchesLabels({ card: y, labelIds: new Set() })).toBe(true);
    expect(
      cardMatchesLabels({ card: x, labelIds: new Set(['l1', 'l9']) }),
    ).toBe(true);
    expect(cardMatchesLabels({ card: y, labelIds: new Set(['l1']) })).toBe(
      false,
    );
  });
});

import {
  blockerChanges,
  type CardsPair,
  checklistChange,
} from './activity-links';
import { activityText } from './activity-text';
import type { BoardCard } from './board';

const at = '2026-11-26T12:00:00.000Z';

function placements(cards: readonly BoardCard[]) {
  return new Map(cards.map((card) => [card.id, { card }]));
}

describe('blockerChanges', () => {
  it('registra um bloqueador que entrou e outro que saiu, pelo título', () => {
    const before: BoardCard = { id: 'c', title: 'C', blockedBy: ['a'] };
    const after: BoardCard = { id: 'c', title: 'C', blockedBy: ['b'] };
    const titles: CardsPair = {
      before: placements([before, { id: 'a', title: 'Aprovar' }]),
      after: placements([after, { id: 'b', title: 'Revisar' }]),
    };
    expect(blockerChanges({ before, after, titles, at })).toEqual([
      { at, kind: 'blocker-added', blocker: 'Revisar' },
      { at, kind: 'blocker-removed', blocker: 'Aprovar' },
    ]);
  });

  it('usa o id quando o bloqueador não está em lugar nenhum', () => {
    const before: BoardCard = { id: 'c', title: 'C' };
    const after: BoardCard = { id: 'c', title: 'C', blockedBy: ['z'] };
    const titles: CardsPair = {
      before: placements([before]),
      after: placements([after]),
    };
    expect(blockerChanges({ before, after, titles, at })).toEqual([
      { at, kind: 'blocker-added', blocker: 'z' },
    ]);
  });

  it('não registra nada quando a lista é a mesma', () => {
    const card: BoardCard = { id: 'c', title: 'C', blockedBy: ['a'] };
    const titles: CardsPair = {
      before: placements([card]),
      after: placements([card]),
    };
    expect(blockerChanges({ before: card, after: card, titles, at })).toEqual(
      [],
    );
    const plain: BoardCard = { id: 'd', title: 'D' };
    expect(
      blockerChanges({ before: plain, after: { ...plain }, titles, at }),
    ).toEqual([]);
  });
});

describe('checklistChange', () => {
  const before: BoardCard = {
    id: 'p',
    title: 'Pai',
    checklist: [
      { id: 'item-1', text: 'Comprar', done: false },
      { id: 'item-2', text: 'Pagar', done: true },
    ],
  };
  const after: BoardCard = {
    ...before,
    checklist: [{ id: 'item-2', text: 'Pagar', done: true }],
  };

  it('registra o item que virou card filho', () => {
    const child: BoardCard = {
      id: 'f',
      title: 'Comprar',
      parentId: 'p',
      activity: [
        { at, kind: 'from-checklist', lane: 'A fazer', parent: 'Pai' },
      ],
    };
    const titles: CardsPair = {
      before: placements([before]),
      after: placements([after, child]),
    };
    expect(checklistChange({ before, after, titles, at })).toEqual({
      at,
      kind: 'checklist-converted',
      item: 'Comprar',
    });
  });

  it('registra o progresso quando o item só saiu do checklist', () => {
    const other: BoardCard = { id: 'f', title: 'Comprar', parentId: 'p' };
    const titles: CardsPair = {
      before: placements([before]),
      after: placements([after, other]),
    };
    expect(checklistChange({ before, after, titles, at })).toEqual({
      at,
      kind: 'checklist',
      done: 1,
      total: 1,
    });
  });

  it('registra o progresso quando nenhum item saiu', () => {
    const toggled: BoardCard = {
      ...before,
      checklist: [{ id: 'item-1', text: 'Comprar', done: true }],
    };
    const first: BoardCard = { ...before, checklist: undefined };
    const titles: CardsPair = {
      before: placements([first]),
      after: placements([toggled]),
    };
    expect(
      checklistChange({ before: first, after: toggled, titles, at }),
    ).toEqual({ at, kind: 'checklist', done: 1, total: 1 });
  });
});

describe('activityText das dependências e do checklist convertido', () => {
  it('descreve cada registro em uma frase', () => {
    expect(
      activityText({ at, kind: 'blocker-added', blocker: 'Revisar' }),
    ).toBe('Passou a ser bloqueado por Revisar.');
    expect(
      activityText({ at, kind: 'blocker-removed', blocker: 'Revisar' }),
    ).toBe('Deixou de ser bloqueado por Revisar.');
    expect(
      activityText({ at, kind: 'checklist-converted', item: 'Comprar' }),
    ).toBe('Item "Comprar" do checklist convertido em card filho.');
    expect(
      activityText({
        at,
        kind: 'from-checklist',
        lane: 'A fazer',
        parent: 'Pai',
      }),
    ).toBe('Criado em A fazer a partir de um item do checklist de Pai.');
  });
});

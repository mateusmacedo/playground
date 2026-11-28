import type { BoardLane } from './board';
import {
  aggregateProgress,
  childProgress,
  descendantProgress,
  progressNoun,
  progressText,
} from './completion';

// a > b > c e a > d; c e d estão concluídos; x e y formam um ciclo gravado à mão.
const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B', parentId: 'a' },
      { id: 'x', title: 'X', parentId: 'y' },
      { id: 'y', title: 'Y', parentId: 'x' },
      { id: 'o', title: 'Órfão', parentId: 'sumiu' },
    ],
  },
  {
    id: 'done',
    title: 'Concluído',
    cards: [
      { id: 'c', title: 'C', parentId: 'b' },
      { id: 'd', title: 'D', parentId: 'a' },
    ],
  },
];

describe('descendantProgress', () => {
  it('conta todas as descendentes, e não só os filhos diretos', () => {
    const progress = descendantProgress({ lanes, doneLaneId: 'done' });
    expect(progress.get('a')).toEqual({ done: 2, total: 3 });
    expect(progress.get('b')).toEqual({ done: 1, total: 1 });
    expect(progress.has('c')).toBe(false);
    expect(childProgress({ lanes, doneLaneId: 'done' }).get('a')).toEqual({
      done: 1,
      total: 2,
    });
  });

  it('termina num ciclo de pais e ignora o pai que não está nas colunas', () => {
    const progress = descendantProgress({ lanes, doneLaneId: 'done' });
    expect(progress.get('x')).toEqual({ done: 0, total: 1 });
    expect(progress.get('y')).toEqual({ done: 0, total: 1 });
    expect(progress.has('sumiu')).toBe(false);
  });

  it('não há progresso sem coluna de conclusão válida', () => {
    expect(descendantProgress({ lanes, doneLaneId: undefined }).size).toBe(0);
    expect(descendantProgress({ lanes, doneLaneId: 'sumiu' }).size).toBe(0);
  });
});

describe('aggregateProgress', () => {
  it('marca como aninhado o progresso que passa dos filhos diretos', () => {
    const progress = aggregateProgress({ lanes, doneLaneId: 'done' });
    expect(progress.get('a')).toEqual({ done: 2, total: 3, nested: true });
    expect(progress.get('b')).toEqual({ done: 1, total: 1 });
    expect(progress.get('x')).toEqual({ done: 0, total: 1 });
  });

  it('deixa de fora o pai que não está nas colunas e o quadro sem coluna de conclusão', () => {
    expect(aggregateProgress({ lanes, doneLaneId: 'done' }).has('sumiu')).toBe(
      false,
    );
    expect(aggregateProgress({ lanes, doneLaneId: undefined }).size).toBe(0);
  });
});

describe('progressText e progressNoun', () => {
  it('fala em filhos quando a contagem é só dos filhos diretos', () => {
    expect(progressText({ done: 1, total: 1 })).toBe('1 de 1 filho concluído');
    expect(progressText({ done: 1, total: 2 })).toBe(
      '1 de 2 filhos concluídos',
    );
    expect(progressNoun({ done: 1, total: 2 })).toBe('filhos');
  });

  it('fala em descendentes quando a contagem inclui netos em diante', () => {
    const progress = { done: 2, total: 3, nested: true };
    expect(progressText(progress)).toBe('2 de 3 descendentes concluídos');
    expect(progressNoun(progress)).toBe('descendentes');
  });
});

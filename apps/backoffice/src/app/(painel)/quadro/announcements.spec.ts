import { announcementText } from './announcements';
import type { BoardLane } from './board';

const lanes: readonly BoardLane[] = [
  { id: 'todo', title: 'A fazer', cards: [{ id: 'a', title: 'Item A' }] },
  {
    id: 'doing',
    title: 'Em andamento',
    cards: [
      { id: 'b', title: 'Item B' },
      { id: 'c', title: 'Item C' },
    ],
  },
];

describe('announcementText', () => {
  it('anuncia cada passo com a coluna e a posição atuais', () => {
    expect(announcementText({ kind: 'grabbed', lanes, cardId: 'a' })).toBe(
      'Item A pego: coluna A fazer, posição 1 de 1.',
    );
    expect(announcementText({ kind: 'moved', lanes, cardId: 'c' })).toBe(
      'Item C: coluna Em andamento, posição 2 de 2.',
    );
    expect(announcementText({ kind: 'dropped', lanes, cardId: 'b' })).toBe(
      'Item B solto: coluna Em andamento, posição 1 de 2.',
    );
    expect(announcementText({ kind: 'cancelled', lanes, cardId: 'a' })).toBe(
      'Movimento cancelado. Item A voltou para coluna A fazer, posição 1 de 1.',
    );
  });

  it('não anuncia card que não está no quadro', () => {
    expect(announcementText({ kind: 'moved', lanes, cardId: 'x' })).toBe('');
  });
});

import { announcementText, laneAnnouncementText } from './announcements';
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

  it('avisa quando o card deixa a coluna acima do limite', () => {
    const limited = lanes.map((lane) =>
      lane.id === 'doing' ? { ...lane, wipLimit: 1 } : lane,
    );
    expect(
      announcementText({ kind: 'moved', lanes: limited, cardId: 'b' }),
    ).toBe(
      'Item B: coluna Em andamento, posição 1 de 2. Coluna Em andamento acima do limite: 2 cards para 1.',
    );
    expect(
      announcementText({ kind: 'dropped', lanes: limited, cardId: 'c' }),
    ).toContain('acima do limite');
    expect(
      announcementText({ kind: 'grabbed', lanes: limited, cardId: 'c' }),
    ).not.toContain('acima do limite');
  });
});

describe('laneAnnouncementText', () => {
  it('anuncia cada passo com a posição da coluna no quadro', () => {
    expect(
      laneAnnouncementText({ kind: 'grabbed', lanes, laneId: 'todo' }),
    ).toBe('Coluna A fazer pega: posição 1 de 2.');
    expect(
      laneAnnouncementText({ kind: 'moved', lanes, laneId: 'doing' }),
    ).toBe('Coluna Em andamento: posição 2 de 2.');
    expect(
      laneAnnouncementText({ kind: 'dropped', lanes, laneId: 'todo' }),
    ).toBe('Coluna A fazer solta: posição 1 de 2.');
    expect(
      laneAnnouncementText({ kind: 'cancelled', lanes, laneId: 'todo' }),
    ).toBe('Movimento cancelado. Coluna A fazer voltou para a posição 1 de 2.');
  });

  it('não anuncia coluna que não está no quadro', () => {
    expect(laneAnnouncementText({ kind: 'moved', lanes, laneId: 'x' })).toBe(
      '',
    );
  });
});

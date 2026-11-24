import type { BoardLane } from './board';
import {
  dueStatus,
  formatFullDate,
  formatShortDate,
  isDateOnly,
  setDueDate,
  setDueDone,
  todayIso,
} from './due';

const lanes: readonly BoardLane[] = [
  { id: 'a', title: 'A', cards: [{ id: 'x', title: 'X' }] },
];

describe('prazo', () => {
  it('aceita só data existente no formato AAAA-MM-DD', () => {
    expect(isDateOnly('2026-11-28')).toBe(true);
    expect(isDateOnly('2026-02-30')).toBe(false);
    expect(isDateOnly('28/11/2026')).toBe(false);
  });

  it('define, marca como cumprido e tira o prazo junto com a marca', () => {
    const withDue = setDueDate({ lanes, cardId: 'x', dueDate: '2026-11-28' });
    expect(withDue[0]?.cards[0]?.dueDate).toBe('2026-11-28');
    expect(
      setDueDate({ lanes: withDue, cardId: 'x', dueDate: '2026-11-28' }),
    ).toBe(withDue);

    const done = setDueDone({ lanes: withDue, cardId: 'x', done: true });
    expect(done[0]?.cards[0]?.dueDone).toBe(true);
    expect(setDueDone({ lanes: done, cardId: 'x', done: true })).toBe(done);
    expect(
      setDueDone({ lanes: done, cardId: 'x', done: false })[0]?.cards[0]
        ?.dueDone,
    ).toBeUndefined();

    const cleared = setDueDate({ lanes: done, cardId: 'x', dueDate: '' });
    expect(cleared[0]?.cards[0]).toEqual({ id: 'x', title: 'X' });
  });

  it('ignora data inválida e marca de cumprido em card sem prazo', () => {
    expect(setDueDate({ lanes, cardId: 'x', dueDate: '2026-13-01' })).toBe(
      lanes,
    );
    expect(setDueDone({ lanes, cardId: 'x', done: true })).toBe(lanes);
  });

  it('calcula a situação do prazo em relação a hoje', () => {
    const today = '2026-11-24';
    expect(dueStatus({ card: {}, today })).toBeUndefined();
    expect(dueStatus({ card: { dueDate: '2026-11-20' }, today })).toBe(
      'overdue',
    );
    expect(dueStatus({ card: { dueDate: today }, today })).toBe('today');
    expect(dueStatus({ card: { dueDate: '2026-12-01' }, today })).toBe(
      'upcoming',
    );
    expect(
      dueStatus({ card: { dueDate: '2026-11-20', dueDone: true }, today }),
    ).toBe('done');
  });

  it('formata as datas e a data de hoje', () => {
    expect(formatShortDate('2026-11-28')).toBe('28 de nov.');
    expect(formatFullDate('2026-11-28')).toBe('28/11/2026');
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

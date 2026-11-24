import type { BoardLane } from './board';
import {
  brokenLock,
  mergeVisible,
  respectsLocks,
  setLaneHidden,
  setLaneLocked,
  showAllLanes,
  visibleLanes,
} from './lane-state';

const lanes: readonly BoardLane[] = [
  { id: 'a', title: 'A', cards: [{ id: 'x', title: 'X' }] },
  { id: 'b', title: 'B', cards: [], hidden: true },
  { id: 'c', title: 'C', cards: [{ id: 'y', title: 'Y' }] },
];

describe('colunas ocultas e bloqueadas', () => {
  it('mostra só as visíveis e devolve as ocultas ao lugar', () => {
    const shown = visibleLanes(lanes);
    expect(shown.map((lane) => lane.id)).toEqual(['a', 'c']);

    const swapped = [shown[1], shown[0]] as BoardLane[];
    expect(
      mergeVisible({ all: lanes, visible: swapped }).map((lane) => lane.id),
    ).toEqual(['c', 'b', 'a']);

    const extra = { id: 'd', title: 'D', cards: [] };
    expect(
      mergeVisible({ all: lanes, visible: [...shown, extra] }).map(
        (lane) => lane.id,
      ),
    ).toEqual(['a', 'b', 'c', 'd']);
    expect(
      mergeVisible({ all: lanes, visible: shown.slice(0, 1) }).map(
        (lane) => lane.id,
      ),
    ).toEqual(['a', 'b']);
  });

  it('oculta e mostra colunas, sem ocultar a última visível', () => {
    const hidden = setLaneHidden({ lanes, laneId: 'a', hidden: true });
    expect(hidden[0]?.hidden).toBe(true);
    expect(setLaneHidden({ lanes: hidden, laneId: 'c', hidden: true })).toBe(
      hidden,
    );
    expect(setLaneHidden({ lanes, laneId: 'b', hidden: true })).toBe(lanes);
    expect(setLaneHidden({ lanes, laneId: 'z', hidden: true })).toBe(lanes);
    expect(
      setLaneHidden({ lanes, laneId: 'b', hidden: false })[1],
    ).not.toHaveProperty('hidden', true);

    const all = showAllLanes(hidden);
    expect(all.every((lane) => !lane.hidden)).toBe(true);
    expect(showAllLanes(all)).toBe(all);
  });

  it('bloqueia a coluna e recusa mudar os cards dela', () => {
    const locked = setLaneLocked({ lanes, laneId: 'a', locked: true });
    expect(locked[0]?.locked).toBe(true);
    expect(setLaneLocked({ lanes: locked, laneId: 'a', locked: true })).toBe(
      locked,
    );

    const moved = locked.map((lane) =>
      lane.id === 'a'
        ? { ...lane, cards: [] }
        : lane.id === 'c'
          ? { ...lane, cards: [...lane.cards, { id: 'x', title: 'X' }] }
          : lane,
    );
    expect(respectsLocks({ before: locked, after: moved })).toBe(false);
    expect(brokenLock({ before: locked, after: moved })?.id).toBe('a');

    const renamed = locked.map((lane) =>
      lane.id === 'a'
        ? { ...lane, cards: [{ id: 'x', title: 'Outro título' }] }
        : lane,
    );
    expect(respectsLocks({ before: locked, after: renamed })).toBe(true);
    expect(brokenLock({ before: locked, after: renamed })).toBeUndefined();

    const unlocked = setLaneLocked({
      lanes: locked,
      laneId: 'a',
      locked: false,
    });
    expect(respectsLocks({ before: locked, after: unlocked })).toBe(true);
    expect(
      respectsLocks({
        before: locked,
        after: locked.filter((lane) => lane.id !== 'a'),
      }),
    ).toBe(false);
  });
});

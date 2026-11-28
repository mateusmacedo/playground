import { CASCADE_LENGTH, CASCADE_STEP, cascadeOffset } from './insert-cascade';

describe('cascadeOffset', () => {
  it('põe a primeira inserção no centro do canvas', () => {
    expect(cascadeOffset(0)).toBe(0);
  });

  it('desloca cada inserção seguinte em 24px', () => {
    const offsets = [1, 2, 3, 4].map(cascadeOffset);

    expect(offsets).toEqual([24, 48, 72, 96]);
    expect(CASCADE_STEP).toBe(24);
  });

  it('volta ao centro na sexta inserção e repete o ciclo de cinco', () => {
    expect(CASCADE_LENGTH).toBe(5);
    expect(cascadeOffset(5)).toBe(0);
    expect(cascadeOffset(6)).toBe(24);
    expect(cascadeOffset(10)).toBe(0);
  });
});

import { cardOf, laneCardIds, processBoard, runOf } from './process-test-data';

describe('apoio de teste do processo do card', () => {
  it('falha quando o card ou a execução procurada não existe', () => {
    const board = processBoard({ todo: [{ id: 'a', title: 'A' }] });
    expect(() => cardOf({ board, cardId: 'x' })).toThrow(
      'Card x fora das colunas.',
    );
    expect(() => runOf(cardOf({ board, cardId: 'a' }))).toThrow(
      'Card a sem processo.',
    );
    expect(laneCardIds({ board, laneId: 'x' })).toEqual([]);
  });
});

import type { BoardLane } from './board';
import { sampleLanes } from './sample-board';
import { parseStoredBoard, serializeBoard } from './storage';

const stored = (lanes: unknown, version: unknown = 1) =>
  JSON.stringify({ version, lanes });

describe('serializeBoard e parseStoredBoard', () => {
  it('devolve o mesmo quadro que foi gravado', () => {
    const lanes: readonly BoardLane[] = [
      ...sampleLanes,
      { id: 'lane-1', title: 'Limitada', cards: [], wipLimit: 2 },
    ];
    expect(parseStoredBoard(serializeBoard(lanes))).toEqual(lanes);
  });

  it('ignora ausência, JSON inválido e outra versão', () => {
    expect(parseStoredBoard(null)).toBeNull();
    expect(parseStoredBoard('')).toBeNull();
    expect(parseStoredBoard('{quebrado')).toBeNull();
    expect(parseStoredBoard(stored(sampleLanes, 2))).toBeNull();
    expect(parseStoredBoard('[]')).toBeNull();
    expect(parseStoredBoard(stored('colunas'))).toBeNull();
  });

  it('ignora quadro sem colunas ou com coluna ou card fora do formato', () => {
    expect(parseStoredBoard(stored([]))).toBeNull();
    expect(parseStoredBoard(stored([{ id: 'a', title: 'A' }]))).toBeNull();
    expect(parseStoredBoard(stored([null]))).toBeNull();
    expect(
      parseStoredBoard(stored([{ id: 'a', title: 'A', cards: [{ id: 1 }] }])),
    ).toBeNull();
    expect(
      parseStoredBoard(
        stored([
          {
            id: 'a',
            title: 'A',
            cards: [{ id: 'x', title: 'X', description: 3 }],
          },
        ]),
      ),
    ).toBeNull();
  });

  it('ignora limite que não é inteiro positivo', () => {
    for (const wipLimit of [0, -1, 1.5, '3']) {
      expect(
        parseStoredBoard(
          stored([{ id: 'a', title: 'A', cards: [], wipLimit }]),
        ),
      ).toBeNull();
    }
  });

  it('ignora ids repetidos, pai inexistente e ciclo na hierarquia', () => {
    const lane = (cards: unknown[], id = 'a') => ({ id, title: id, cards });
    expect(
      parseStoredBoard(
        stored([
          lane([
            { id: 'x', title: 'X' },
            { id: 'x', title: 'Y' },
          ]),
        ]),
      ),
    ).toBeNull();
    expect(parseStoredBoard(stored([lane([]), lane([])]))).toBeNull();
    expect(
      parseStoredBoard(
        stored([lane([{ id: 'x', title: 'X', parentId: 'ghost' }])]),
      ),
    ).toBeNull();
    expect(
      parseStoredBoard(
        stored([
          lane([
            { id: 'x', title: 'X', parentId: 'y' },
            { id: 'y', title: 'Y', parentId: 'x' },
          ]),
        ]),
      ),
    ).toBeNull();
  });
});

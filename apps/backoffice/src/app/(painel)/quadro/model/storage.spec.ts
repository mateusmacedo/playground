import type { Board } from './board';
import { createBoard } from './board-state';
import { sampleLabels, sampleLanes } from './sample-board';
import { parseStoredBoard, serializeBoard } from './storage';

/** Formato da versão 1: só as colunas. */
const v1 = (lanes: unknown, version: unknown = 1) =>
  JSON.stringify({ version, lanes });

/** Formato da versão 2: o quadro inteiro. */
const v2 = (board: unknown) => JSON.stringify({ version: 2, board });

const sample: Board = createBoard({ lanes: sampleLanes, labels: sampleLabels });

describe('gravação do quadro', () => {
  it('devolve o mesmo quadro que foi gravado, com arquivo, etiquetas e histórico', () => {
    const board: Board = {
      ...sample,
      lanes: [
        ...sample.lanes,
        { id: 'lane-1', title: 'Limitada', cards: [], wipLimit: 2 },
      ],
      archive: [
        {
          id: 'card-9',
          archivedAt: '2026-11-24T10:00:00Z',
          cards: [
            {
              laneId: 'todo',
              card: {
                id: 'card-9',
                title: 'Arquivado',
                number: 9,
                dueDate: '2026-11-28',
                dueDone: true,
                activity: [{ at: '2026-11-24T10:00:00Z', kind: 'archived' }],
              },
            },
          ],
        },
      ],
      nextNumber: 10,
    };
    expect(parseStoredBoard(serializeBoard(board))).toEqual(board);
  });

  it('migra a versão 1 numerando os cards na ordem da tela', () => {
    const board = parseStoredBoard(v1(sampleLanes));
    expect(
      board?.lanes.flatMap((lane) => lane.cards.map((card) => card.number)),
    ).toEqual([1, 2, 3, 4]);
    expect(board?.nextNumber).toBe(5);
    expect(board?.labels).toEqual([]);
  });

  it('descarta dados opcionais estragados sem perder o card', () => {
    const board = parseStoredBoard(
      v2({
        lanes: [
          {
            id: 'a',
            title: 'A',
            cards: [
              {
                id: 'x',
                title: 'X',
                number: -1,
                labelIds: ['label-1', 'fantasma', 3],
                dueDate: '2026-02-30',
                dueDone: true,
                checklist: [
                  { id: 'i', text: 'Passo', done: false },
                  { id: 'j' },
                ],
                activity: [{ at: 'agora', kind: 'archived' }, 'lixo'],
              },
            ],
          },
        ],
        labels: [...sampleLabels, { id: 'cor', name: 'Cor', color: 'rosa' }],
        archive: 'nada',
        nextNumber: 'dez',
      }),
    );
    expect(board?.lanes[0]?.cards[0]).toEqual({
      id: 'x',
      title: 'X',
      number: 1,
      labelIds: ['label-1'],
      checklist: [{ id: 'i', text: 'Passo', done: false }],
      activity: [{ at: 'agora', kind: 'archived' }],
    });
    expect(board?.labels).toEqual(sampleLabels);
    expect(board?.archive).toEqual([]);
  });

  it('ignora ausência, JSON inválido e versão desconhecida', () => {
    expect(parseStoredBoard(null)).toBeNull();
    expect(parseStoredBoard('')).toBeNull();
    expect(parseStoredBoard('{quebrado')).toBeNull();
    expect(parseStoredBoard(v1(sampleLanes, 3))).toBeNull();
    expect(parseStoredBoard('[]')).toBeNull();
    expect(parseStoredBoard(v1('colunas'))).toBeNull();
    expect(
      parseStoredBoard(JSON.stringify({ version: 2, board: 'x' })),
    ).toBeNull();
    expect(parseStoredBoard(v2({ lanes: [] }))).toBeNull();
  });

  it('ignora quadro com coluna ou card fora do formato', () => {
    expect(parseStoredBoard(v1([{ id: 'a', title: 'A' }]))).toBeNull();
    expect(parseStoredBoard(v1([null]))).toBeNull();
    expect(
      parseStoredBoard(v1([{ id: 'a', title: 'A', cards: [{ id: 1 }] }])),
    ).toBeNull();
    expect(
      parseStoredBoard(
        v1([
          {
            id: 'a',
            title: 'A',
            cards: [{ id: 'x', title: 'X', description: 3 }],
          },
        ]),
      ),
    ).toBeNull();
    for (const wipLimit of [0, -1, 1.5, '3']) {
      expect(
        parseStoredBoard(v1([{ id: 'a', title: 'A', cards: [], wipLimit }])),
      ).toBeNull();
    }
  });

  it('ignora arquivamento estragado sem perder o resto', () => {
    const board = parseStoredBoard(
      v2({
        lanes: [{ id: 'a', title: 'A', cards: [] }],
        archive: [
          { id: 'x', archivedAt: 'agora', cards: [] },
          { id: 'y', archivedAt: 'agora', cards: [{ laneId: 'a' }] },
          {
            id: 'z',
            archivedAt: 'agora',
            cards: [{ laneId: 'a', card: { id: 'z', title: 'Z' } }],
          },
          null,
        ],
      }),
    );
    expect(board?.archive.map((entry) => entry.id)).toEqual(['z']);
  });

  it('ignora ids ou números repetidos, pai inexistente e ciclo na hierarquia', () => {
    const lane = (cards: unknown[], id = 'a') => ({ id, title: id, cards });
    expect(
      parseStoredBoard(
        v1([
          lane([
            { id: 'x', title: 'X' },
            { id: 'x', title: 'Y' },
          ]),
        ]),
      ),
    ).toBeNull();
    expect(
      parseStoredBoard(
        v2({
          lanes: [
            lane([
              { id: 'x', title: 'X', number: 1 },
              { id: 'y', title: 'Y', number: 1 },
            ]),
          ],
        }),
      ),
    ).toBeNull();
    expect(parseStoredBoard(v1([lane([]), lane([])]))).toBeNull();
    expect(
      parseStoredBoard(
        v1([lane([{ id: 'x', title: 'X', parentId: 'fantasma' }])]),
      ),
    ).toBeNull();
    expect(
      parseStoredBoard(
        v1([
          lane([
            { id: 'x', title: 'X', parentId: 'y' },
            { id: 'y', title: 'Y', parentId: 'x' },
          ]),
        ]),
      ),
    ).toBeNull();
  });
});

describe('configuração gravada', () => {
  it('devolve o prefixo gravado na versão 3', () => {
    const board = createBoard({
      lanes: sampleLanes,
      config: { keyPrefix: 'OPS' },
    });
    expect(parseStoredBoard(serializeBoard(board))?.config).toEqual({
      keyPrefix: 'OPS',
    });
  });

  it('usa o prefixo padrão na versão 2 e no prefixo inválido', () => {
    expect(parseStoredBoard(v2({ lanes: sampleLanes }))?.config).toEqual({
      keyPrefix: 'QD',
    });
    const broken = JSON.stringify({
      version: 3,
      board: { lanes: sampleLanes, config: { keyPrefix: '1-x' } },
    });
    expect(parseStoredBoard(broken)?.config.keyPrefix).toBe('QD');
    const noConfig = JSON.stringify({
      version: 3,
      board: { lanes: sampleLanes, config: 'x' },
    });
    expect(parseStoredBoard(noConfig)?.config.keyPrefix).toBe('QD');
  });
});

describe('estado das colunas gravado', () => {
  it('devolve colunas ocultas e bloqueadas e a coluna de arquivados oculta', () => {
    const board = createBoard({
      lanes: [
        { id: 'a', title: 'A', cards: [], hidden: true },
        { id: 'b', title: 'B', cards: [], locked: true },
      ],
      config: { keyPrefix: 'QD', archiveLaneHidden: true },
    });
    const parsed = parseStoredBoard(serializeBoard(board));
    expect(parsed?.lanes.map((lane) => [lane.hidden, lane.locked])).toEqual([
      [true, undefined],
      [undefined, true],
    ]);
    expect(parsed?.config.archiveLaneHidden).toBe(true);
  });

  it('ignora marcas que não são `true`', () => {
    const raw = JSON.stringify({
      version: 3,
      board: {
        lanes: [{ id: 'a', title: 'A', cards: [], hidden: 'sim', locked: 1 }],
        config: { keyPrefix: 'QD', archiveLaneHidden: 'sim' },
      },
    });
    const parsed = parseStoredBoard(raw);
    expect(parsed?.lanes[0]?.hidden).toBeUndefined();
    expect(parsed?.lanes[0]?.locked).toBeUndefined();
    expect(parsed?.config.archiveLaneHidden).toBeUndefined();
  });
});

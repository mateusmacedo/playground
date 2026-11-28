import { boardHref, readBoardCard, readRunningCards } from './board-run';
import { begin } from './engine-test-kit';
import { linearPlan, parallelPlan } from './engine-test-plans';

/** Execução parada na primeira etapa do roteiro em linha. */
const run = begin(linearPlan);

const card = {
  id: 'card-1',
  title: 'Atender o pedido',
  number: 12,
  process: run,
};

/** Conteúdo de um quadro como o painel grava, só com o que o diagrama lê e um pouco do que ele ignora. */
function boardWith(overrides: Record<string, unknown> = {}) {
  return {
    lanes: [
      {
        id: 'todo',
        title: 'A fazer',
        cards: [{ id: 'card-2', title: 'Outro' }],
      },
      { id: 'doing', title: 'Fazendo', cards: [card] },
    ],
    archive: [],
    labels: [],
    nextNumber: 13,
    config: { keyPrefix: 'QD' },
    ...overrides,
  };
}

function read(board: unknown, cardId = 'card-1') {
  return readBoardCard({ boardId: 'board-1', board, cardId });
}

describe('boardHref', () => {
  it('aponta para o quadro pelo id dele', () => {
    expect(boardHref('board 2')).toBe('/quadro?quadro=board+2');
  });
});

describe('readBoardCard', () => {
  it('lê o código com o título, o endereço do card e a execução dele', () => {
    expect(read(boardWith())).toEqual({
      cardLabel: 'QD-12 Atender o pedido',
      backHref: '/quadro?quadro=board-1&card=QD-12',
      run,
    });
  });

  it('acha o card arquivado, que o quadro ainda abre para leitura', () => {
    const board = boardWith({
      lanes: [],
      archive: [
        {
          id: 'card-1',
          archivedAt: '2026-11-26T12:00:00.000Z',
          cards: [{ card, laneId: 'doing' }],
        },
      ],
    });

    expect(read(board)?.cardLabel).toBe('QD-12 Atender o pedido');
  });

  it('devolve o card sem execução quando ele não segue processo', () => {
    expect(read(boardWith(), 'card-2')).toEqual({
      cardLabel: 'Outro',
      backHref: '/quadro?quadro=board-1',
      run: undefined,
    });
  });

  it('descarta a execução gravada que não dá para ler', () => {
    const board = boardWith({
      lanes: [{ id: 'doing', cards: [{ ...card, process: { status: 7 } }] }],
    });

    expect(read(board)?.run).toBeUndefined();
  });

  it('usa só o código quando o card não tem título legível', () => {
    const board = boardWith({
      lanes: [{ id: 'doing', cards: [{ ...card, title: '  ' }] }],
    });

    expect(read(board)?.cardLabel).toBe('QD-12');
  });

  it('usa um nome genérico quando faltam o código e o título', () => {
    const board = boardWith({
      lanes: [{ id: 'doing', cards: [{ id: 'card-1' }] }],
      config: undefined,
    });

    expect(read(board)).toEqual({
      cardLabel: 'Card sem título',
      backHref: '/quadro?quadro=board-1',
      run: undefined,
    });
  });

  it('fica sem o código quando o quadro não tem prefixo legível', () => {
    const board = boardWith({ config: { keyPrefix: '' } });

    expect(read(board)?.cardLabel).toBe('Atender o pedido');
  });

  it('não acha o card que não está no quadro', () => {
    expect(read(boardWith(), 'card-9')).toBeNull();
  });

  it('não acha nada no conteúdo que não é um quadro', () => {
    expect(read(null)).toBeNull();
    expect(read('quadro')).toBeNull();
    expect(read({})).toBeNull();
  });

  it('ignora o que está fora do formato sem perder o card', () => {
    const board = boardWith({
      lanes: ['coluna', { id: 'sem cards' }, { id: 'doing', cards: [7, card] }],
      archive: ['arquivo', { id: 'x', cards: ['card', { card: null }] }],
    });

    expect(read(board)?.cardLabel).toBe('QD-12 Atender o pedido');
  });
});

describe('readRunningCards', () => {
  /** O roteiro em linha como o quadro o guarda, na versão da execução de teste. */
  const stored = {
    definitionId: run.definitionId,
    version: run.version,
    name: run.name,
    plan: linearPlan,
  };

  function running(board: unknown) {
    return readRunningCards({ boardId: 'board-1', board });
  }

  function ids(board: unknown) {
    return running(board).map((item) => item.cardId);
  }

  it('lê o card em andamento com o nome, o endereço, a execução e o roteiro guardado no quadro', () => {
    expect(running(boardWith({ processes: [stored] }))).toEqual([
      {
        cardId: 'card-1',
        cardLabel: 'QD-12 Atender o pedido',
        cardHref: '/quadro?quadro=board-1&card=QD-12',
        run,
        plan: linearPlan,
      },
    ]);
  });

  it('segue a ordem das colunas e dos cards na tela', () => {
    const second = {
      id: 'card-3',
      title: 'Conferir',
      number: 14,
      process: run,
    };
    const board = boardWith({
      lanes: [
        { id: 'todo', cards: [second] },
        { id: 'doing', cards: [card, { ...card, id: 'card-4', number: 15 }] },
      ],
      processes: [stored],
    });

    expect(ids(board)).toEqual(['card-3', 'card-1', 'card-4']);
  });

  it('deixa de fora a execução encerrada', () => {
    const board = boardWith({
      lanes: [
        {
          id: 'doing',
          cards: [
            { ...card, process: { ...run, status: 'completed', tokens: [] } },
            { ...card, id: 'card-5', process: { ...run, status: 'cancelled' } },
          ],
        },
      ],
      processes: [stored],
    });

    expect(running(board)).toEqual([]);
  });

  it('deixa de fora o card sem id, sem processo ou com a execução ilegível, sem perder os outros', () => {
    const board = boardWith({
      lanes: [
        {
          id: 'doing',
          cards: [
            'card',
            { title: 'Sem id', process: run },
            { id: '  ', process: run },
            { id: 'card-2', title: 'Sem processo' },
            { id: 'card-6', process: { status: 7 } },
            card,
          ],
        },
      ],
      processes: [stored],
    });

    expect(ids(board)).toEqual(['card-1']);
  });

  it('deixa de fora a execução cujo roteiro o quadro não guarda', () => {
    const otherVersion = { ...stored, version: 2 };
    const otherProcess = { ...stored, definitionId: 'process-9' };

    expect(running(boardWith())).toEqual([]);
    expect(running(boardWith({ processes: 'roteiros' }))).toEqual([]);
    expect(
      running(boardWith({ processes: [otherVersion, otherProcess] })),
    ).toEqual([]);
  });

  it('ignora o roteiro guardado fora do formato', () => {
    const board = boardWith({
      processes: [
        'roteiro',
        { ...stored, definitionId: '' },
        { ...stored, version: 0 },
        { ...stored, plan: { startId: 'nada', steps: [] } },
      ],
    });

    expect(running(board)).toEqual([]);
  });

  it('fica com o primeiro roteiro quando a versão vem repetida', () => {
    const board = boardWith({
      processes: [stored, { ...stored, plan: parallelPlan }],
    });

    expect(running(board)[0]?.plan).toEqual(linearPlan);
  });

  it('não conta o card arquivado, em que o quadro não deixa agir', () => {
    const board = boardWith({
      lanes: [],
      archive: [
        {
          id: 'card-1',
          archivedAt: '2026-11-26T12:00:00.000Z',
          cards: [{ card, laneId: 'doing' }],
        },
      ],
      processes: [stored],
    });

    expect(running(board)).toEqual([]);
  });

  it('não acha nada no conteúdo que não é um quadro', () => {
    expect(running(null)).toEqual([]);
    expect(running('quadro')).toEqual([]);
    expect(running({})).toEqual([]);
  });
});

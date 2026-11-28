import type { Board, BoardCard } from './board';
import {
  addBlocker,
  BLOCKER_MISSING,
  blockedCardIds,
  blockedCardsOf,
  blockerCandidates,
  blockersOf,
  cycleRefusal,
  dependsOn,
  pendingBlockers,
  pruneBlockers,
  removeBlocker,
  SELF_BLOCK,
  withKnownBlockers,
} from './dependencies';
import { CARD_MISSING } from './process-run';
import { cardOf, processBoard } from './process-test-data';

const ids = (cards: readonly BoardCard[]) => cards.map((card) => card.id);

// c depende de b, que depende de a; d está solto e e já está na coluna de conclusão.
function chainBoard(): Board {
  return processBoard({
    todo: [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B', blockedBy: ['a'] },
    ],
    doing: [
      { id: 'c', title: 'C', blockedBy: ['b', 'e'] },
      { id: 'd', title: 'D' },
    ],
    done: [{ id: 'e', title: 'E' }],
  });
}

describe('blockersOf e blockedCardsOf', () => {
  it('lista quem bloqueia o card e quem ele bloqueia, na ordem da tela', () => {
    const { lanes } = chainBoard();
    expect(ids(blockersOf({ lanes, cardId: 'c' }))).toEqual(['b', 'e']);
    expect(ids(blockersOf({ lanes, cardId: 'sumiu' }))).toEqual([]);
    expect(ids(blockedCardsOf({ lanes, cardId: 'b' }))).toEqual(['c']);
    expect(ids(blockedCardsOf({ lanes, cardId: 'd' }))).toEqual([]);
  });
});

describe('dependsOn', () => {
  it('segue a cadeia de bloqueadores', () => {
    const { lanes } = chainBoard();
    expect(dependsOn({ lanes, cardId: 'c', targetId: 'a' })).toBe(true);
    expect(dependsOn({ lanes, cardId: 'a', targetId: 'c' })).toBe(false);
    expect(dependsOn({ lanes, cardId: 'd', targetId: 'a' })).toBe(false);
  });

  it('termina num ciclo gravado à mão', () => {
    const board = processBoard({
      todo: [
        { id: 'x', title: 'X', blockedBy: ['y'] },
        { id: 'y', title: 'Y', blockedBy: ['x'] },
      ],
    });
    const { lanes } = board;
    expect(dependsOn({ lanes, cardId: 'x', targetId: 'z' })).toBe(false);
  });
});

describe('blockerCandidates', () => {
  it('exclui o próprio card, quem já bloqueia e quem fecharia um ciclo', () => {
    const { lanes } = chainBoard();
    expect(ids(blockerCandidates({ lanes, cardId: 'b' }))).toEqual(['d', 'e']);
    expect(ids(blockerCandidates({ lanes, cardId: 'd' }))).toEqual([
      'a',
      'b',
      'c',
      'e',
    ]);
  });
});

describe('addBlocker', () => {
  it('acrescenta o bloqueador no fim da lista', () => {
    const result = addBlocker({
      board: chainBoard(),
      cardId: 'c',
      blockerId: 'd',
    });
    expect(result.ok).toBe(true);
    const board = result.ok ? result.board : chainBoard();
    expect(cardOf({ board, cardId: 'c' }).blockedBy).toEqual(['b', 'e', 'd']);
  });

  it('cria a lista no card que não tinha bloqueador', () => {
    const result = addBlocker({
      board: chainBoard(),
      cardId: 'd',
      blockerId: 'a',
    });
    const board = result.ok ? result.board : chainBoard();
    expect(cardOf({ board, cardId: 'd' }).blockedBy).toEqual(['a']);
  });

  it('devolve o mesmo quadro quando o bloqueador já estava na lista', () => {
    const board = chainBoard();
    expect(addBlocker({ board, cardId: 'c', blockerId: 'b' })).toEqual({
      ok: true,
      board,
    });
  });

  it('recusa o auto-bloqueio, o card ausente e o ciclo', () => {
    const board = chainBoard();
    expect(addBlocker({ board, cardId: 'a', blockerId: 'a' })).toEqual({
      ok: false,
      message: SELF_BLOCK,
    });
    expect(addBlocker({ board, cardId: 'sumiu', blockerId: 'a' })).toEqual({
      ok: false,
      message: CARD_MISSING,
    });
    expect(addBlocker({ board, cardId: 'a', blockerId: 'sumiu' })).toEqual({
      ok: false,
      message: BLOCKER_MISSING,
    });
    const cycle = addBlocker({ board, cardId: 'a', blockerId: 'c' });
    expect(cycle).toEqual({
      ok: false,
      message: cycleRefusal({
        card: cardOf({ board, cardId: 'a' }),
        blocker: cardOf({ board, cardId: 'c' }),
      }),
    });
    expect(cycle.ok ? '' : cycle.message).toBe(
      'O card C já depende de A: a dependência fecharia um ciclo.',
    );
  });
});

describe('removeBlocker', () => {
  it('tira o bloqueador e apaga a lista que fica vazia', () => {
    const once = removeBlocker({
      board: chainBoard(),
      cardId: 'c',
      blockerId: 'b',
    });
    expect(cardOf({ board: once, cardId: 'c' }).blockedBy).toEqual(['e']);
    const empty = removeBlocker({ board: once, cardId: 'b', blockerId: 'a' });
    expect(cardOf({ board: empty, cardId: 'b' }).blockedBy).toBeUndefined();
  });

  it('devolve o mesmo quadro quando o card não tinha o bloqueador', () => {
    const board = chainBoard();
    expect(removeBlocker({ board, cardId: 'd', blockerId: 'a' })).toBe(board);
  });
});

describe('pendingBlockers', () => {
  it('conta só os bloqueadores fora da coluna de conclusão', () => {
    const board = chainBoard();
    expect(ids(pendingBlockers({ board, cardId: 'c' }))).toEqual(['b']);
  });

  it('conta todos sem coluna de conclusão', () => {
    const board = { ...chainBoard(), config: { keyPrefix: 'QD' } };
    expect(ids(pendingBlockers({ board, cardId: 'c' }))).toEqual(['b', 'e']);
  });
});

describe('blockedCardIds', () => {
  it('marca só os cards com bloqueador fora da coluna de conclusão', () => {
    const board = processBoard({
      todo: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B', blockedBy: ['a'] },
        { id: 'f', title: 'F', blockedBy: ['e'] },
        { id: 'g', title: 'G', blockedBy: ['sumiu'] },
      ],
      done: [{ id: 'e', title: 'E' }],
    });
    expect([...blockedCardIds(board)]).toEqual(['b']);
  });

  it('marca todos os cards com bloqueador quando não há coluna de conclusão', () => {
    const board = { ...chainBoard(), config: { keyPrefix: 'QD' } };
    expect([...blockedCardIds(board)]).toEqual(['b', 'c']);
  });
});

describe('withKnownBlockers', () => {
  it('tira o próprio card e quem não está nas colunas', () => {
    const card: BoardCard = { id: 'a', title: 'A', blockedBy: ['a', 'b', 'z'] };
    const liveIds = new Set(['a', 'b']);
    expect(withKnownBlockers({ card, liveIds }).blockedBy).toEqual(['b']);
    const only: BoardCard = { id: 'a', title: 'A', blockedBy: ['z'] };
    expect(
      withKnownBlockers({ card: only, liveIds }).blockedBy,
    ).toBeUndefined();
  });

  it('devolve o próprio card quando não há o que tirar', () => {
    const card: BoardCard = { id: 'a', title: 'A', blockedBy: ['b'] };
    const liveIds = new Set(['a', 'b']);
    expect(withKnownBlockers({ card, liveIds })).toBe(card);
    const free: BoardCard = { id: 'c', title: 'C' };
    expect(withKnownBlockers({ card: free, liveIds })).toBe(free);
  });
});

describe('pruneBlockers', () => {
  it('tira dos cards o bloqueador que saiu das colunas e mantém o card arquivado como está', () => {
    const board = chainBoard();
    const archived: BoardCard = { id: 'b', title: 'B', blockedBy: ['a'] };
    const changed: Board = {
      ...board,
      lanes: board.lanes.map((lane) => ({
        ...lane,
        cards: lane.cards.filter((card) => card.id !== 'b'),
      })),
      archive: [
        {
          id: 'b',
          archivedAt: '2026-11-26T12:00:00.000Z',
          cards: [{ card: archived, laneId: 'todo' }],
        },
      ],
    };
    const pruned = pruneBlockers(changed);
    expect(cardOf({ board: pruned, cardId: 'c' }).blockedBy).toEqual(['e']);
    expect(pruned.archive).toBe(changed.archive);
  });

  it('devolve o próprio quadro quando todos os bloqueadores estão nas colunas', () => {
    const board = chainBoard();
    expect(pruneBlockers(board)).toBe(board);
  });
});

import type { Board, BoardCard, BoardRules } from './board';
import { moveCard } from './card-moves';
import { addCard } from './cards';
import { doneRefusal } from './done-guard';
import { DONE_LANE, processBoard, runningCard } from './process-test-data';

interface MoveParams {
  readonly board: Board;
  readonly cardId: string;
}

function toDone(params: MoveParams): Board {
  const { board, cardId } = params;
  const lanes = moveCard({
    lanes: board.lanes,
    cardId,
    toLaneId: DONE_LANE,
    toIndex: 0,
  });
  return { ...board, lanes };
}

interface GuardParams {
  readonly todo: readonly BoardCard[];
  readonly done?: readonly BoardCard[];
  readonly rules?: BoardRules;
  readonly cardId: string;
}

/** Recusa para levar o card à coluna de conclusão. */
function refusalFor(params: GuardParams): string | undefined {
  const before = processBoard({
    todo: params.todo,
    done: params.done,
    rules: params.rules,
  });
  return doneRefusal({
    before,
    after: toDone({ board: before, cardId: params.cardId }),
  });
}

const parent: BoardCard = { id: 'p', title: 'Pai' };
const child = (id: string): BoardCard => ({
  id,
  title: `Filho ${id}`,
  parentId: 'p',
});

describe('doneRefusal', () => {
  it('recusa o pai com filho fora da coluna de conclusão', () => {
    expect(
      refusalFor({
        todo: [parent, child('a'), child('b')],
        rules: { parentWaitsChildren: true },
        cardId: 'p',
      }),
    ).toBe(
      'O card Pai tem 2 filhos fora de Concluído: conclua os filhos antes de levar o card para lá.',
    );
    expect(
      refusalFor({
        todo: [parent, child('a')],
        done: [child('b')],
        rules: { parentWaitsChildren: true },
        cardId: 'p',
      }),
    ).toBe(
      'O card Pai tem 1 filho fora de Concluído: conclua os filhos antes de levar o card para lá.',
    );
  });

  it('deixa entrar o pai com todos os filhos concluídos', () => {
    expect(
      refusalFor({
        todo: [parent],
        done: [child('a')],
        rules: { parentWaitsChildren: true },
        cardId: 'p',
      }),
    ).toBeUndefined();
  });

  it('recusa o card com processo em andamento', () => {
    expect(
      refusalFor({
        todo: [runningCard({ id: 'a' })],
        rules: { doneWaitsProcess: true },
        cardId: 'a',
      }),
    ).toBe(
      'O card Card a tem o processo Processo em andamento: conclua ou cancele o processo antes de levar o card para Concluído.',
    );
  });

  it('recusa o card com bloqueador fora da coluna de conclusão', () => {
    expect(
      refusalFor({
        todo: [
          { id: 'a', title: 'A', blockedBy: ['b', 'c', 'd'] },
          { id: 'b', title: 'B' },
          { id: 'c', title: 'C' },
        ],
        done: [{ id: 'd', title: 'D' }],
        rules: { doneWaitsBlockers: true },
        cardId: 'a',
      }),
    ).toBe(
      'O card A está bloqueado por B, C: conclua o que o bloqueia antes de levar o card para Concluído.',
    );
  });

  it('deixa entrar quando a regra correspondente está desligada', () => {
    expect(
      refusalFor({
        todo: [
          { ...runningCard({ id: 'a' }), blockedBy: ['b'] },
          { id: 'b', title: 'B', parentId: 'a' },
        ],
        rules: { childInherits: true },
        cardId: 'a',
      }),
    ).toBeUndefined();
  });

  it('deixa entrar o card que cumpre as três regras ligadas', () => {
    expect(
      refusalFor({
        todo: [{ id: 'a', title: 'A', blockedBy: ['d'] }],
        done: [{ id: 'd', title: 'D' }],
        rules: {
          doneWaitsProcess: true,
          parentWaitsChildren: true,
          doneWaitsBlockers: true,
        },
        cardId: 'a',
      }),
    ).toBeUndefined();
  });

  it('não confere nada sem regras ou sem coluna de conclusão', () => {
    const card = runningCard({ id: 'a' });
    expect(refusalFor({ todo: [card], cardId: 'a' })).toBeUndefined();
    const before = processBoard({
      todo: [card],
      rules: { doneWaitsProcess: true },
      withoutDoneLane: true,
    });
    expect(
      doneRefusal({ before, after: toDone({ board: before, cardId: 'a' }) }),
    ).toBeUndefined();
  });

  it('confere também o card criado direto na coluna de conclusão', () => {
    const before = processBoard({
      todo: [{ id: 'a', title: 'A' }],
      rules: { doneWaitsBlockers: true },
    });
    const lanes = addCard({
      lanes: before.lanes,
      laneId: DONE_LANE,
      card: { id: 'n', title: 'Novo' },
    });
    const created = { ...before, lanes };
    const blocked = {
      ...created,
      lanes: created.lanes.map((lane) => ({
        ...lane,
        cards: lane.cards.map((card) =>
          card.id === 'n' ? { ...card, blockedBy: ['a'] } : card,
        ),
      })),
    };
    expect(doneRefusal({ before, after: blocked })).toContain(
      'bloqueado por A',
    );
  });

  it('não confere o card que já estava na coluna de conclusão', () => {
    const before = processBoard({
      done: [runningCard({ id: 'a' })],
      rules: { doneWaitsProcess: true },
    });
    const after = {
      ...before,
      lanes: before.lanes.map((lane) => ({ ...lane })),
    };
    expect(doneRefusal({ before, after })).toBeUndefined();
  });
});

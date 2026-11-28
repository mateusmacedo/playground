import { act, renderHook } from '@testing-library/react';

import { tokenAt } from '@/shared/process/engine-test-kit';

import type { BoardLane } from './model/board';
import { SELF_BLOCK } from './model/dependencies';
import { boardProcess, cardOf, runOf } from './model/process-test-data';
import { type UseBoardParams, useBoard } from './use-board';

const initialLanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      {
        id: 'a',
        title: 'Contrato',
        assigneeId: 'ana',
        labelIds: ['urgente'],
        checklist: [{ id: 'item-1', text: 'Assinar', done: false }],
      },
      { id: 'b', title: 'Revisão' },
    ],
  },
  { id: 'done', title: 'Concluído', cards: [] },
];

function renderBoard(params: Partial<UseBoardParams> = {}) {
  const onRefused = vi.fn();
  const hook = renderHook(() =>
    useBoard({ initialLanes, onRefused, ...params }),
  );
  return { ...hook, onRefused };
}

function activityKinds(params: {
  readonly hook: ReturnType<typeof renderBoard>;
  readonly cardId: string;
}) {
  const board = params.hook.result.current.board;
  const card = cardOf({ board, cardId: params.cardId });
  return (card.activity ?? []).map((entry) => entry.kind);
}

describe('useBoard e as dependências entre cards', () => {
  it('liga e desliga o bloqueador, registrando no histórico do card', () => {
    const hook = renderBoard();
    const { result } = hook;
    let refusal: string | undefined = 'não chamou';
    act(() => {
      refusal = result.current.commands.addBlocker({
        cardId: 'a',
        blockerId: 'b',
      });
    });
    expect(refusal).toBeUndefined();
    expect(
      cardOf({ board: result.current.board, cardId: 'a' }).blockedBy,
    ).toEqual(['b']);
    act(() => {
      result.current.commands.removeBlocker({ cardId: 'a', blockerId: 'b' });
    });
    const card = cardOf({ board: result.current.board, cardId: 'a' });
    expect(card.blockedBy).toBeUndefined();
    expect(card.activity).toEqual([
      expect.objectContaining({ kind: 'blocker-added', blocker: 'Revisão' }),
      expect.objectContaining({ kind: 'blocker-removed', blocker: 'Revisão' }),
    ]);
  });

  it('devolve a recusa sem mudar o quadro', () => {
    const { result } = renderBoard();
    const board = result.current.board;
    let refusal: string | undefined;
    act(() => {
      refusal = result.current.commands.addBlocker({
        cardId: 'a',
        blockerId: 'a',
      });
    });
    expect(refusal).toBe(SELF_BLOCK);
    expect(result.current.board).toBe(board);
  });

  it('tira o bloqueador excluído e o arquivado, e restaurar não o devolve', () => {
    const hook = renderBoard();
    const { result } = hook;
    act(() => {
      result.current.commands.addBlocker({ cardId: 'a', blockerId: 'b' });
    });
    act(() => {
      result.current.commands.archiveCard('b');
    });
    expect(
      cardOf({ board: result.current.board, cardId: 'a' }).blockedBy,
    ).toBeUndefined();
    expect(activityKinds({ hook, cardId: 'a' })).toEqual([
      'blocker-added',
      'blocker-removed',
    ]);
    act(() => {
      result.current.commands.restoreArchived('b');
    });
    expect(
      cardOf({ board: result.current.board, cardId: 'a' }).blockedBy,
    ).toBeUndefined();

    act(() => {
      result.current.commands.addBlocker({ cardId: 'a', blockerId: 'b' });
    });
    act(() => {
      result.current.commands.removeCard('b');
    });
    expect(
      cardOf({ board: result.current.board, cardId: 'a' }).blockedBy,
    ).toBeUndefined();
  });
});

describe('useBoard e a hierarquia', () => {
  it('converte o item do checklist em card filho num passo só do desfazer', () => {
    const hook = renderBoard();
    const { result } = hook;
    const before = result.current.board;
    let childId: string | undefined;
    act(() => {
      childId = result.current.commands.convertChecklistItem({
        cardId: 'a',
        itemId: 'item-1',
      });
    });
    const board = result.current.board;
    const child = cardOf({ board, cardId: childId ?? '' });
    expect(child).toMatchObject({ title: 'Assinar', parentId: 'a' });
    expect(child.activity?.map((entry) => entry.kind)).toEqual([
      'from-checklist',
    ]);
    expect(cardOf({ board, cardId: 'a' }).checklist).toBeUndefined();
    expect(activityKinds({ hook, cardId: 'a' })).toEqual([
      'checklist-converted',
    ]);

    act(() => {
      result.current.commands.undo();
    });
    expect(result.current.board).toBe(before);
  });

  it('avisa a recusa da conversão', () => {
    const { result, onRefused } = renderBoard();
    let childId: string | undefined = 'não chamou';
    act(() => {
      childId = result.current.commands.convertChecklistItem({
        cardId: 'a',
        itemId: 'item-9',
      });
    });
    expect(childId).toBeUndefined();
    expect(onRefused).toHaveBeenCalledWith(
      'O item não está mais no checklist do card.',
    );
  });

  it('duplica o card com os filhos e avisa a recusa', () => {
    const { result, onRefused } = renderBoard();
    act(() => {
      result.current.commands.setParent({ cardId: 'b', parentId: 'a' });
    });
    let copyId: string | undefined;
    act(() => {
      copyId = result.current.commands.duplicateCardTree('a');
    });
    const board = result.current.board;
    const copy = cardOf({ board, cardId: copyId ?? '' });
    expect(copy.title).toBe('Contrato (cópia)');
    const copiedChildren = board.lanes
      .flatMap((lane) => lane.cards)
      .filter((card) => card.parentId === copy.id);
    expect(copiedChildren.map((card) => card.title)).toEqual(['Revisão']);

    act(() => {
      copyId = result.current.commands.duplicateCardTree('sumiu');
    });
    expect(copyId).toBeUndefined();
    expect(onRefused).toHaveBeenCalledWith('O card não está mais no quadro.');
  });

  it('o card filho novo herda o responsável e as etiquetas com a regra ligada', () => {
    const { result } = renderBoard();
    act(() => {
      result.current.commands.configure({ rules: { childInherits: true } });
    });
    let childId: string | undefined;
    act(() => {
      childId = result.current.commands.addCard({
        laneId: 'todo',
        title: 'Filho',
        parentId: 'a',
      });
    });
    const child = cardOf({
      board: result.current.board,
      cardId: childId ?? '',
    });
    expect(child).toMatchObject({ assigneeId: 'ana', labelIds: ['urgente'] });
  });

  it('o card filho de uma etapa também herda com a regra ligada', () => {
    const { result } = renderBoard();
    act(() => {
      result.current.commands.configure({ rules: { childInherits: true } });
    });
    act(() => {
      result.current.commands.startProcess({
        cardId: 'a',
        process: boardProcess(),
      });
    });
    const run = runOf(cardOf({ board: result.current.board, cardId: 'a' }));
    const tokenId = tokenAt({ run, stepRef: 'a' }).id;
    let childId: string | undefined;
    act(() => {
      childId = result.current.commands.delegateStep({ cardId: 'a', tokenId });
    });
    const child = cardOf({
      board: result.current.board,
      cardId: childId ?? '',
    });
    expect(child).toMatchObject({ assigneeId: 'ana', labelIds: ['urgente'] });
  });
});

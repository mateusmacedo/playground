import { act, renderHook } from '@testing-library/react';

import { UNKNOWN_TOKEN } from '@/shared/process/engine-result';
import { tokenAt } from '@/shared/process/engine-test-kit';

import type { BoardLane } from './model/board';
import { ALREADY_RUNNING } from './model/process-run';
import { boardProcess, cardOf, runOf } from './model/process-test-data';
import { type UseBoardParams, useBoard } from './use-board';

const initialLanes: readonly BoardLane[] = [
  { id: 'todo', title: 'A fazer', cards: [{ id: 'a', title: 'Contrato' }] },
  { id: 'done', title: 'Concluído', cards: [] },
];

const process = boardProcess();

function renderBoard(params: Partial<UseBoardParams> = {}) {
  const onRefused = vi.fn();
  const hook = renderHook(() =>
    useBoard({ initialLanes, onRefused, ...params }),
  );
  return { ...hook, onRefused };
}

describe('useBoard e o processo do card', () => {
  it('inicia o processo no card e recusa iniciar outro em andamento', () => {
    const { result } = renderBoard();
    let refusal: string | undefined = 'não chamou';
    act(() => {
      refusal = result.current.commands.startProcess({ cardId: 'a', process });
    });
    expect(refusal).toBeUndefined();
    const board = result.current.board;
    expect(runOf(cardOf({ board, cardId: 'a' })).status).toBe('running');
    expect(board.processes).toEqual([process]);

    act(() => {
      refusal = result.current.commands.startProcess({ cardId: 'a', process });
    });
    expect(refusal).toBe(ALREADY_RUNNING);
    expect(result.current.board).toBe(board);
  });

  it('avança a etapa e devolve a recusa do motor', () => {
    const { result } = renderBoard();
    act(() => {
      result.current.commands.startProcess({ cardId: 'a', process });
    });
    const run = runOf(cardOf({ board: result.current.board, cardId: 'a' }));
    const tokenId = tokenAt({ run, stepRef: 'a' }).id;
    let refusal: string | undefined;
    act(() => {
      refusal = result.current.commands.advanceProcess({
        cardId: 'a',
        action: { kind: 'complete', tokenId },
        by: 'Ana',
      });
    });
    expect(refusal).toBeUndefined();
    act(() => {
      refusal = result.current.commands.advanceProcess({
        cardId: 'a',
        action: { kind: 'complete', tokenId },
      });
    });
    expect(refusal).toBe(UNKNOWN_TOKEN.message);
    const next = runOf(cardOf({ board: result.current.board, cardId: 'a' }));
    expect(tokenAt({ run: next, stepRef: 'b' })).toBeDefined();
  });

  it('cria o card filho da etapa e avisa quando não dá para delegar', () => {
    const { result, onRefused } = renderBoard();
    act(() => {
      result.current.commands.startProcess({ cardId: 'a', process });
    });
    const run = runOf(cardOf({ board: result.current.board, cardId: 'a' }));
    const tokenId = tokenAt({ run, stepRef: 'a' }).id;
    let childId: string | undefined;
    act(() => {
      childId = result.current.commands.delegateStep({ cardId: 'a', tokenId });
    });
    expect(childId).toBeDefined();
    const child = cardOf({
      board: result.current.board,
      cardId: childId ?? '',
    });
    expect(child).toMatchObject({
      title: 'a',
      parentId: 'a',
      stepOf: { cardId: 'a', tokenId },
    });

    act(() => {
      childId = result.current.commands.delegateStep({ cardId: 'a', tokenId });
    });
    expect(childId).toBeUndefined();
    expect(onRefused).toHaveBeenCalledWith('Esta etapa já está delegada.');
  });

  it('tira do card a execução cancelada', () => {
    const { result } = renderBoard();
    act(() => {
      result.current.commands.startProcess({ cardId: 'a', process });
    });
    act(() => {
      result.current.commands.advanceProcess({
        cardId: 'a',
        action: { kind: 'cancel' },
      });
    });
    act(() => {
      result.current.commands.removeProcess('a');
    });
    const board = result.current.board;
    expect(cardOf({ board, cardId: 'a' }).process).toBeUndefined();
    expect(board.processes).toBeUndefined();
  });

  it('recusa levar à coluna de conclusão o card com processo em andamento e avisa o motivo', () => {
    const { result, onRefused } = renderBoard();
    act(() => {
      result.current.commands.configure({
        doneLaneId: 'done',
        rules: { doneWaitsProcess: true },
      });
    });
    expect(result.current.board.config.rules).toEqual({
      doneWaitsProcess: true,
    });
    act(() => {
      result.current.commands.startProcess({ cardId: 'a', process });
    });
    const board = result.current.board;
    act(() => {
      result.current.commands.moveCardToLane({ cardId: 'a', laneId: 'done' });
    });
    expect(result.current.board).toBe(board);
    expect(onRefused).toHaveBeenCalledWith(
      'O card Contrato tem o processo Processo em andamento: conclua ou cancele o processo antes de levar o card para Concluído.',
    );
  });

  it('restaura o exemplo sem passar pelas regras do quadro', () => {
    const { result, onRefused } = renderBoard({
      initialLanes: [
        { id: 'todo', title: 'A fazer', cards: [] },
        { id: 'done', title: 'Concluído', cards: [{ id: 'p', title: 'Pai' }] },
      ],
    });
    act(() => {
      result.current.commands.configure({
        doneLaneId: 'done',
        rules: { parentWaitsChildren: true },
      });
    });
    act(() => {
      result.current.commands.moveCardToLane({ cardId: 'p', laneId: 'todo' });
    });
    act(() => {
      result.current.commands.addCard({
        laneId: 'todo',
        title: 'Filho',
        parentId: 'p',
      });
    });
    act(() => {
      result.current.commands.reset();
    });
    expect(onRefused).not.toHaveBeenCalled();
    expect(result.current.board.lanes[1]?.cards.map((card) => card.id)).toEqual(
      ['p'],
    );
  });
});

import { act, renderHook } from '@testing-library/react';

import { begin } from '@/shared/process/engine-test-kit';
import { linearPlan } from '@/shared/process/engine-test-plans';
import type { ProcessRun } from '@/shared/process/run';

import type { Announce } from './board-notices';
import type { BoardCard } from './model/board';
import { boardProcess } from './model/process-test-data';
import {
  type ProcessCommands,
  type UseCardProcessParams,
  useCardProcess,
} from './use-card-process';

const process = boardProcess();
const running = begin(linearPlan);
const plain: BoardCard = { id: 'c1', title: 'Tarefa' };

function fakeCommands(
  overrides: Partial<ProcessCommands> = {},
): ProcessCommands {
  return {
    startProcess: vi.fn(() => undefined),
    advanceProcess: vi.fn(() => undefined),
    removeProcess: vi.fn(),
    delegateStep: vi.fn(() => 'child-1'),
    ...overrides,
  };
}

interface RenderParams {
  readonly card?: BoardCard;
  readonly commands?: ProcessCommands;
  /** Sem ele, a seção fica sem quem anuncie. */
  readonly announce?: Announce;
}

function renderCardProcess(params: RenderParams = {}) {
  const commands = params.commands ?? fakeCommands();
  const initialProps: UseCardProcessParams = {
    card: params.card ?? plain,
    commands,
    by: 'Ana',
    announce: params.announce,
  };
  const hook = renderHook(
    (props: UseCardProcessParams) => useCardProcess(props),
    { initialProps },
  );
  return { ...hook, commands, initialProps };
}

function withRun(run: ProcessRun): BoardCard {
  return { ...plain, process: run };
}

describe('useCardProcess', () => {
  it('inicia o processo com quem age e anuncia o início', () => {
    const announce = vi.fn<Announce>();
    const { result, commands } = renderCardProcess({ announce });

    let refusal: string | undefined;
    act(() => {
      refusal = result.current.actions.start(process);
    });

    expect(refusal).toBeUndefined();
    expect(commands.startProcess).toHaveBeenCalledWith({
      cardId: 'c1',
      process,
      by: 'Ana',
    });
    expect(announce).toHaveBeenCalledWith(
      'Processo Processo iniciado no card Tarefa.',
    );
  });

  it('devolve o motivo e não anuncia quando o quadro recusa iniciar o processo', () => {
    const announce = vi.fn<Announce>();
    const commands = fakeCommands({ startProcess: () => 'Já em andamento.' });
    const { result } = renderCardProcess({ commands, announce });

    let refusal: string | undefined;
    act(() => {
      refusal = result.current.actions.start(process);
    });

    expect(refusal).toBe('Já em andamento.');
    expect(announce).not.toHaveBeenCalled();
  });

  it('anuncia a ação que o processo aceitou, com o texto pedido', () => {
    const announce = vi.fn<Announce>();
    const { result, commands } = renderCardProcess({
      card: withRun(running),
      announce,
    });

    act(() => {
      result.current.actions.advance({
        action: { kind: 'cancel' },
        announcement: 'Processo Processo cancelado.',
      });
    });

    expect(commands.advanceProcess).toHaveBeenCalledWith({
      cardId: 'c1',
      action: { kind: 'cancel' },
      by: 'Ana',
    });
    expect(announce).toHaveBeenCalledWith('Processo Processo cancelado.');
  });

  it('devolve o motivo e não anuncia quando o processo recusa a ação', () => {
    const announce = vi.fn<Announce>();
    const commands = fakeCommands({ advanceProcess: () => 'Falta o motivo.' });
    const { result } = renderCardProcess({
      card: withRun(running),
      commands,
      announce,
    });

    let refusal: string | undefined;
    act(() => {
      refusal = result.current.actions.advance({
        action: { kind: 'cancel' },
        announcement: 'Processo Processo cancelado.',
      });
    });

    expect(refusal).toBe('Falta o motivo.');
    expect(announce).not.toHaveBeenCalled();
  });

  it('anuncia o card filho criado e chama de "sem nome" a etapa sem nome', () => {
    const announce = vi.fn<Announce>();
    const { result, commands } = renderCardProcess({
      card: withRun(running),
      announce,
    });

    act(() => {
      result.current.actions.delegate({ tokenId: 'token-1', stepLabel: '  ' });
    });

    expect(commands.delegateStep).toHaveBeenCalledWith({
      cardId: 'c1',
      tokenId: 'token-1',
      by: 'Ana',
    });
    expect(announce).toHaveBeenCalledWith(
      'Card filho criado para a etapa sem nome.',
    );
  });

  it('não anuncia o card filho quando o quadro recusa criá-lo', () => {
    const announce = vi.fn<Announce>();
    const commands = fakeCommands({ delegateStep: () => undefined });
    const { result } = renderCardProcess({
      card: withRun(running),
      commands,
      announce,
    });

    act(() => {
      result.current.actions.delegate({ tokenId: 'token-1', stepLabel: 'a' });
    });

    expect(announce).not.toHaveBeenCalled();
  });

  it('anuncia o fim do processo sem desfecho quando o último Fim não tem um', () => {
    const announce = vi.fn<Announce>();
    const { rerender, initialProps } = renderCardProcess({
      card: withRun(running),
      announce,
    });

    rerender({
      ...initialProps,
      card: withRun({ ...running, status: 'completed' }),
    });

    expect(announce).toHaveBeenCalledWith('Processo Processo concluído.');
  });

  it('não anuncia o fim do processo que já chegou concluído nem o do cancelado', () => {
    const announce = vi.fn<Announce>();
    const { rerender, initialProps } = renderCardProcess({
      card: withRun({ ...running, status: 'completed' }),
      announce,
    });

    rerender({
      ...initialProps,
      card: withRun({ ...running, status: 'cancelled' }),
    });

    expect(announce).not.toHaveBeenCalled();
  });

  it('age no processo mesmo sem quem anuncie', () => {
    const { result, rerender, commands, initialProps } = renderCardProcess({
      card: withRun(running),
    });

    act(() => {
      result.current.actions.remove('Processo');
    });
    rerender({
      ...initialProps,
      card: withRun({ ...running, status: 'completed' }),
    });

    expect(commands.removeProcess).toHaveBeenCalledWith('c1');
  });
});

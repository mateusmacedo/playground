import type { BoardCommands } from './board-commands';
import type { Announce } from './board-notices';
import type { BoardFocus } from './use-board-focus';

export interface UseHistoryActionsParams {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly commands: Pick<BoardCommands, 'undo' | 'redo'>;
  /** Solta o que estiver pego pelo teclado antes de desfazer ou refazer. */
  readonly releaseKeyboard: () => void;
  readonly announce: Announce;
  readonly focus: Pick<BoardFocus, 'focusMarked'>;
}

export interface HistoryActions {
  readonly undo: () => void;
  readonly redo: () => void;
}

type Direction = 'undo' | 'redo';

/** Desfazer e refazer do quadro, com o anúncio para o leitor de tela e o foco de volta ao botão. */
export function useHistoryActions(
  params: UseHistoryActionsParams,
): HistoryActions {
  const { canUndo, canRedo, commands, releaseKeyboard, announce, focus } =
    params;

  function run(direction: Direction) {
    const available = direction === 'undo' ? canUndo : canRedo;
    if (!available) {
      return;
    }
    releaseKeyboard();
    commands[direction]();
    announce(
      direction === 'undo' ? 'Alteração desfeita.' : 'Alteração refeita.',
    );
    requestAnimationFrame(() => {
      // NOTE: desfazer pode tirar da tela o elemento que tinha o foco; nesse caso o foco vai para o botão de desfazer.
      if (document.activeElement === document.body) {
        focus.focusMarked({ attribute: 'data-board-undo', id: '' });
      }
    });
  }

  return { undo: () => run('undo'), redo: () => run('redo') };
}

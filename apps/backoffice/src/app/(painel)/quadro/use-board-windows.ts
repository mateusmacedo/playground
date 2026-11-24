import type { BoardCommands } from './board-commands';
import type { LockWarning } from './lock-warning';
import type { Board } from './model/board';
import { type ArchiveViewState, useArchiveView } from './use-archive-view';
import { type BoardDialogsState, useBoardDialogs } from './use-board-dialogs';
import type { BoardFeedback } from './use-board-feedback';
import type { BoardFocus } from './use-board-focus';
import { type CardPanel, useCardPanel } from './use-card-panel';
import { type ListDialogs, useListDialogs } from './use-list-dialogs';

export interface UseBoardWindowsParams {
  readonly board: Board;
  readonly commands: BoardCommands;
  readonly feedback: Pick<BoardFeedback, 'announce' | 'notify'>;
  readonly focus: BoardFocus;
  readonly blockedByLock: LockWarning;
}

/** O painel e as janelas que o quadro abre por cima das colunas. */
export interface BoardWindows {
  /** Painel de detalhes do card. */
  readonly panel: CardPanel;
  /** Janela do card arquivado, só para leitura. */
  readonly archiveView: ArchiveViewState;
  /** Janelas de confirmação: limite, exclusões e restauração do exemplo. */
  readonly dialogs: BoardDialogsState;
  /** Janelas abertas pela barra: arquivados, etiquetas e configuração. */
  readonly listDialogs: ListDialogs;
}

export function useBoardWindows(params: UseBoardWindowsParams): BoardWindows {
  const { board, commands, feedback, focus, blockedByLock } = params;
  const { lanes } = board;
  const { announce, notify } = feedback;

  const panel = useCardPanel({
    lanes,
    commands,
    announce,
    focus,
    blockedByLock,
  });
  const archiveView = useArchiveView({ board, commands, announce, notify });
  const dialogs = useBoardDialogs({
    lanes,
    commands,
    announce,
    focus,
    blockedByLock,
    onReset: panel.clear,
  });
  const listDialogs = useListDialogs();

  return { panel, archiveView, dialogs, listDialogs };
}

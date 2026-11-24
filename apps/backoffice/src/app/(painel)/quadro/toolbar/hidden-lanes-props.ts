import type { BoardCommands } from '../board-commands';
import type { Board } from '../model/board';
import type { BoardFocus } from '../use-board-focus';
import type { HiddenLanesProps } from './hidden-lanes';

export interface HiddenLanesPropsParams {
  readonly board: Board;
  readonly commands: Pick<
    BoardCommands,
    'setLaneHidden' | 'showAllLanes' | 'setArchiveLaneHidden'
  >;
  readonly focus: Pick<BoardFocus, 'focusLaneLater' | 'focusMarkedLater'>;
}

/** O que o menu "Colunas ocultas" mostra e faz: cada coluna oculta, a de arquivados e mostrar todas. */
export function hiddenLanesProps(
  params: HiddenLanesPropsParams,
): HiddenLanesProps {
  const { board, commands, focus } = params;

  return {
    lanes: board.lanes.filter((lane) => lane.hidden),
    archiveHidden: Boolean(board.config.archiveLaneHidden),
    onShow: (laneId) => {
      commands.setLaneHidden({ laneId, hidden: false });
      focus.focusLaneLater(laneId);
    },
    onShowArchive: () => {
      commands.setArchiveLaneHidden(false);
      focus.focusMarkedLater({ attribute: 'data-archive-lane', id: '' });
    },
    onShowAll: () => {
      commands.showAllLanes();
      commands.setArchiveLaneHidden(false);
    },
  };
}

import type { BoardCommands } from '../board-commands';
import { setArchiveLaneHidden } from '../model/config';
import { nextLaneId } from '../model/ids';
import {
  setLaneHidden,
  setLaneLocked,
  showAllLanes,
} from '../model/lane-state';
import { addLane, removeLane, renameLane, setWipLimit } from '../model/lanes';
import type { CommandContext } from './command-context';

export type LaneCommands = Pick<
  BoardCommands,
  | 'setLanes'
  | 'addLane'
  | 'renameLane'
  | 'removeLane'
  | 'setWipLimit'
  | 'setLaneHidden'
  | 'showAllLanes'
  | 'setLaneLocked'
  | 'setArchiveLaneHidden'
>;

/** Comandos das colunas: trocar a ordem, criar, renomear, excluir, limitar, ocultar e bloquear. */
export function laneCommands(context: CommandContext): LaneCommands {
  const { board, commit, commitLanes } = context;

  return {
    setLanes: (change) =>
      commit({
        update: (current) => ({ ...current, lanes: change.lanes }),
        key: change.key,
      }),
    addLane: (title) => {
      if (!title.trim()) {
        return undefined;
      }
      const id = nextLaneId(board.lanes);
      commitLanes({
        update: (lanes) => addLane({ lanes, lane: { id, title } }),
      });
      return id;
    },
    renameLane: (change) =>
      commitLanes({ update: (lanes) => renameLane({ lanes, ...change }) }),
    removeLane: (change) =>
      commitLanes({ update: (lanes) => removeLane({ lanes, ...change }) }),
    setWipLimit: (change) =>
      commitLanes({ update: (lanes) => setWipLimit({ lanes, ...change }) }),
    setLaneHidden: (change) =>
      commitLanes({ update: (lanes) => setLaneHidden({ lanes, ...change }) }),
    showAllLanes: () => commitLanes({ update: showAllLanes }),
    setLaneLocked: (change) =>
      commitLanes({ update: (lanes) => setLaneLocked({ lanes, ...change }) }),
    setArchiveLaneHidden: (hidden) =>
      commit({
        update: (current) => {
          const config = setArchiveLaneHidden({
            config: current.config,
            hidden,
          });
          if (config === current.config) {
            return current;
          }
          return { ...current, config };
        },
      }),
  };
}

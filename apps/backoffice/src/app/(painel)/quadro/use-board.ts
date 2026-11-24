import { useState } from 'react';

import type { BoardCommands } from './board-commands';
import { archiveCommands } from './commands/archive-commands';
import { cardCommands } from './commands/card-commands';
import { cardDataCommands } from './commands/card-data-commands';
import type {
  BoardChange,
  CommandContext,
  LanesOnlyChange,
} from './commands/command-context';
import { labelCommands } from './commands/label-commands';
import { laneCommands } from './commands/lane-commands';
import type { Board, BoardLabel, BoardLane } from './model/board';
import { applyChange } from './model/board-change';
import { configureBoard } from './model/board-settings';
import { createBoard } from './model/board-state';
import { redo, sealHistory, startHistory, undo } from './model/history';
import { useBoardStorage } from './use-board-storage';

export interface UseBoardParams {
  readonly initialLanes: readonly BoardLane[];
  readonly initialLabels?: readonly BoardLabel[];
  readonly storageKey?: string;
}

export interface BoardState {
  readonly board: Board;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** O quadro gravado já foi lido (ou não há o que ler). */
  readonly loaded: boolean;
  /** A última gravação falhou, quase sempre por falta de espaço no navegador. */
  readonly storageFull: boolean;
  readonly commands: BoardCommands;
}

/**
 * Estado do quadro com desfazer e refazer, os comandos de edição e, com `storageKey`, a gravação no navegador. O
 * servidor e a primeira renderização usam o quadro inicial; depois de montar, o quadro gravado e válido o substitui.
 */
export function useBoard(params: UseBoardParams): BoardState {
  const { initialLanes, initialLabels, storageKey } = params;
  const [history, setHistory] = useState(() =>
    startHistory(createBoard({ lanes: initialLanes, labels: initialLabels })),
  );
  const board = history.present;

  const storage = useBoardStorage({
    storageKey,
    board,
    // WHY: o desfazer recomeça, porque desfazer depois da mudança de outra aba gravaria por cima dela um quadro que
    // ela já não tem.
    onStoredBoard: (stored) => setHistory(startHistory(stored)),
  });

  function commit(change: BoardChange) {
    setHistory((current) =>
      applyChange({
        history: current,
        next: change.update(current.present),
        key: change.key,
        log: change.log ?? true,
        at: new Date().toISOString(),
      }),
    );
  }

  function commitLanes(change: LanesOnlyChange) {
    commit({
      key: change.key,
      update: (current) => {
        const lanes = change.update(current.lanes);
        if (lanes === current.lanes) {
          return current;
        }
        return { ...current, lanes };
      },
    });
  }

  const context: CommandContext = { board, commit, commitLanes };
  const commands: BoardCommands = {
    ...laneCommands(context),
    ...cardCommands(context),
    ...cardDataCommands(context),
    ...labelCommands(context),
    ...archiveCommands(context),
    seal: () => setHistory(sealHistory),
    undo: () => setHistory(undo),
    redo: () => setHistory(redo),
    configure: (settings) =>
      commit({
        update: (current) => configureBoard({ board: current, ...settings }),
      }),
    reset: () =>
      commit({
        log: false,
        update: (current) =>
          createBoard({
            lanes: initialLanes,
            labels: initialLabels,
            config: current.config,
          }),
      }),
  };

  return {
    board,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    loaded: storage.loaded,
    storageFull: storage.storageFull,
    commands,
  };
}

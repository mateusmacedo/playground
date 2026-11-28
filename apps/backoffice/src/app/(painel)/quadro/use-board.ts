import { useMemo, useState } from 'react';

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
import { linkCommands } from './commands/link-commands';
import { processCommands } from './commands/process-commands';
import type { Board, BoardLabel, BoardLane } from './model/board';
import { applyChange, changeRefusal } from './model/board-change';
import { configureBoard } from './model/board-settings';
import { createBoard } from './model/board-state';
import { redo, sealHistory, startHistory, undo } from './model/history';
import type { BoardStore } from './store/board-store';
import { createBrowserBoardStore } from './store/browser-board-store';
import { type BoardStorage, useBoardStorage } from './use-board-storage';

export interface UseBoardParams {
  readonly initialLanes: readonly BoardLane[];
  readonly initialLabels?: readonly BoardLabel[];
  /** Chave do quadro no navegador: sem `store`, é nela que o quadro é gravado. */
  readonly storageKey?: string;
  /** Onde o quadro é lido e gravado; sem ele e sem `storageKey`, o quadro vive só na memória. */
  readonly store?: BoardStore;
  /** O quadro recusou uma mudança (uma regra da coluna de conclusão, uma etapa que não dá para delegar). */
  readonly onRefused?: (text: string) => void;
}

export interface BoardState {
  readonly board: Board;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** O quadro gravado já foi lido (ou não há o que ler). */
  readonly loaded: boolean;
  /** A leitura e a gravação do quadro, com as saídas de cada falha. */
  readonly storage: BoardStorage;
  readonly commands: BoardCommands;
}

/**
 * Estado do quadro com desfazer e refazer, os comandos de edição e a gravação: em `store`, quando ele vem, ou no
 * navegador, com `storageKey`. O servidor e a primeira renderização usam o quadro inicial; depois de montar, o quadro
 * gravado e válido o substitui.
 */
export function useBoard(params: UseBoardParams): BoardState {
  const { initialLanes, initialLabels, storageKey, store, onRefused } = params;
  const [history, setHistory] = useState(() =>
    startHistory(createBoard({ lanes: initialLanes, labels: initialLabels })),
  );
  const board = history.present;

  const browserStore = useMemo(
    () =>
      storageKey && !store ? createBrowserBoardStore(storageKey) : undefined,
    [storageKey, store],
  );
  const storage = useBoardStorage({
    store: store ?? browserStore,
    board,
    // WHY: o desfazer recomeça, porque desfazer depois da mudança de fora (outra aba, ou o servidor) gravaria por
    // cima dela um quadro que ela já não tem.
    onStoredBoard: (stored) => setHistory(startHistory(stored)),
  });

  function refuse(text: string) {
    onRefused?.(text);
  }

  function commit(change: BoardChange) {
    const { key } = change;
    const rules = change.rules ?? true;
    // WHY: a recusa das regras do quadro é conferida aqui, com o quadro da tela, para a tela poder dizer o motivo; o
    // `applyChange` confere de novo com o quadro do momento, e é ele que decide.
    const refusal = rules
      ? changeRefusal({ history, next: change.update(board), key })
      : undefined;
    if (refusal !== undefined) {
      refuse(refusal);
      return;
    }
    setHistory((current) =>
      applyChange({
        history: current,
        next: change.update(current.present),
        key,
        log: change.log ?? true,
        at: new Date().toISOString(),
        rules,
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

  const context: CommandContext = { board, commit, commitLanes, refuse };
  const commands: BoardCommands = {
    ...laneCommands(context),
    ...cardCommands(context),
    ...cardDataCommands(context),
    ...labelCommands(context),
    ...archiveCommands(context),
    ...processCommands(context),
    ...linkCommands(context),
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
        // WHY: restaurar o exemplo troca o quadro inteiro; nenhum card "entrou" na coluna de conclusão.
        rules: false,
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
    storage,
    commands,
  };
}

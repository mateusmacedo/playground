import type { BoardCommands } from '../board-commands';
import {
  advanceProcess,
  removeProcess,
  startProcess,
} from '../model/process-run';
import { delegateStep } from '../model/step-delegation';
import { attemptChange } from './attempt-change';
import { nextCardId } from './card-commands';
import type { CommandContext } from './command-context';

export type ProcessCommands = Pick<
  BoardCommands,
  'startProcess' | 'advanceProcess' | 'removeProcess' | 'delegateStep'
>;

/** Comandos do processo do card: iniciar, agir numa etapa, tirar a execução encerrada e entregar a etapa a um filho. */
export function processCommands(context: CommandContext): ProcessCommands {
  const { board, commit, refuse } = context;

  return {
    startProcess: (change) => {
      const at = new Date().toISOString();
      return attemptChange({
        context,
        change: (current) => startProcess({ board: current, ...change, at }),
      });
    },
    advanceProcess: (change) => {
      const at = new Date().toISOString();
      return attemptChange({
        context,
        change: (current) => advanceProcess({ board: current, ...change, at }),
      });
    },
    removeProcess: (cardId) =>
      commit({
        update: (current) => removeProcess({ board: current, cardId }),
      }),
    delegateStep: (change) => {
      const newId = nextCardId(board);
      const at = new Date().toISOString();
      const refusal = attemptChange({
        context,
        change: (current) =>
          delegateStep({ board: current, ...change, newId, at }),
      });
      if (refusal !== undefined) {
        refuse(refusal);
        return undefined;
      }
      return newId;
    },
  };
}

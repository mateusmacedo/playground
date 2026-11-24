import type { BoardCommands, UpdateLabelChange } from '../board-commands';
import {
  createLabel,
  nextLabelId,
  removeLabel,
  toggleCardLabel,
  updateLabel,
} from '../model/labels';
import type { CommandContext } from './command-context';

export type LabelCommands = Pick<
  BoardCommands,
  'toggleLabel' | 'createLabel' | 'updateLabel' | 'removeLabel'
>;

/** Chave que junta a digitação seguida do nome da etiqueta num passo só do desfazer. */
function renameKey(change: UpdateLabelChange): string | undefined {
  if (change.patch.name === undefined) {
    return undefined;
  }
  return `label:${change.labelId}`;
}

/** Comandos das etiquetas: marcar no card, criar, editar e excluir do catálogo. */
export function labelCommands(context: CommandContext): LabelCommands {
  const { board, commit, commitLanes } = context;

  return {
    toggleLabel: (change) =>
      commitLanes({
        update: (lanes) => toggleCardLabel({ lanes, ...change }),
      }),
    createLabel: (input) => {
      const label = {
        id: nextLabelId(board.labels),
        name: input.name,
        color: input.color,
      };
      const { cardId } = input;
      // NOTE: nome vazio ou repetido não cria nada; o teste é feito aqui para devolver `undefined` a quem pediu.
      const wouldChange = createLabel({ board, label, cardId }) !== board;
      if (!wouldChange) {
        return undefined;
      }
      commit({
        update: (current) => createLabel({ board: current, label, cardId }),
      });
      return label.id;
    },
    updateLabel: (change) =>
      commit({
        update: (current) => updateLabel({ board: current, ...change }),
        key: renameKey(change),
      }),
    removeLabel: (labelId) =>
      commit({
        update: (current) => removeLabel({ board: current, labelId }),
      }),
  };
}

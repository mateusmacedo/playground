import type { Board } from '../model/board';
import type { ProcessChange } from '../model/process-run';
import type { CommandContext } from './command-context';

export interface AttemptChangeParams {
  readonly context: CommandContext;
  /** A mudança, calculada sobre o quadro que receber; pode recusar com o motivo. */
  readonly change: (board: Board) => ProcessChange;
}

/**
 * Tenta a mudança no quadro da tela, para responder na hora a quem pediu, e grava a mesma mudança refeita sobre o
 * quadro do momento. Devolve a mensagem da recusa, ou `undefined` quando a mudança foi pedida ao quadro.
 */
export function attemptChange(params: AttemptChangeParams): string | undefined {
  const { context, change } = params;
  const preview = change(context.board);
  if (!preview.ok) {
    return preview.message;
  }
  context.commit({
    update: (current) => {
      const result = change(current);
      return result.ok ? result.board : current;
    },
  });
  return undefined;
}

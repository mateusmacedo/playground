import type { BoardCommands } from '../board-commands';
import type { Announce } from '../board-notices';
import type { BoardCard, BoardLane } from '../model/board';
import { childrenOf } from '../model/hierarchy';

export interface DuplicateTreeParams {
  readonly card: BoardCard;
  readonly lanes: readonly BoardLane[];
  readonly commands: Pick<BoardCommands, 'duplicateCardTree'>;
  readonly onOpenCard: (cardId: string) => void;
  readonly onAnnounce?: Announce;
}

/**
 * Ação "Duplicar com filhos" do painel: copia o card com os descendentes, abre a cópia e avisa o leitor de tela.
 * `undefined` quando o card não tem filhos, e aí o painel não mostra o botão. A recusa do quadro (coluna bloqueada)
 * aparece no aviso que ele já mostra.
 */
export function duplicateTreeAction(
  params: DuplicateTreeParams,
): (() => void) | undefined {
  const { card, lanes, commands, onOpenCard, onAnnounce } = params;
  if (childrenOf({ lanes, cardId: card.id }).length === 0) {
    return undefined;
  }
  return () => {
    const copyId = commands.duplicateCardTree(card.id);
    if (copyId === undefined) {
      return;
    }
    onOpenCard(copyId);
    onAnnounce?.(`Card ${card.title} duplicado com os filhos.`);
  };
}

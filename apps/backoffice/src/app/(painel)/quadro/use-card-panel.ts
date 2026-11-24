import { useState } from 'react';
import type { BoardCommands } from './board-commands';
import type { Announce } from './board-notices';
import type { LockWarning } from './lock-warning';
import { type BoardLane, type CardLocation, findCard } from './model/board';
import type { BoardFocus } from './use-board-focus';

export interface UseCardPanelParams {
  readonly lanes: readonly BoardLane[];
  readonly commands: Pick<BoardCommands, 'archiveCard' | 'duplicateCard'>;
  readonly announce: Announce;
  readonly focus: Pick<BoardFocus, 'focusMarked' | 'focusLaneLater'>;
  readonly blockedByLock: LockWarning;
}

export interface CardPanel {
  /** Onde está o card do painel; `undefined` sem card aberto ou com o card fora do quadro. */
  readonly location: CardLocation | undefined;
  readonly visible: boolean;
  /** Id do card mostrado no painel agora; `undefined` com o painel fechado. */
  readonly shownCardId: string | undefined;
  readonly open: (cardId: string) => void;
  readonly close: () => void;
  /** Larga o card sem animação nem foco, quando o quadro volta ao exemplo. */
  readonly clear: () => void;
  readonly archive: (cardId: string) => void;
  readonly duplicate: (cardId: string) => void;
}

/** Painel de detalhes do card: qual card ele mostra e as ações do card que mexem no quadro. */
export function useCardPanel(params: UseCardPanelParams): CardPanel {
  const { lanes, commands, announce, focus, blockedByLock } = params;
  // NOTE: fechar mantém o id, para o conteúdo continuar na tela enquanto o painel sai dela.
  const [cardId, setCardId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  const location = cardId ? findCard({ lanes, cardId }) : undefined;
  const visible = opened && location !== undefined;

  function open(nextCardId: string) {
    setCardId(nextCardId);
    setOpened(true);
  }

  function close() {
    if (!cardId) {
      return;
    }
    setOpened(false);
    focus.focusMarked({ attribute: 'data-card-open', id: cardId });
  }

  function clear() {
    setCardId(null);
    setOpened(false);
  }

  function archive(targetCardId: string) {
    const target = findCard({ lanes, cardId: targetCardId });
    if (!target || blockedByLock({ cardId: targetCardId })) {
      return;
    }
    commands.archiveCard(targetCardId);
    announce(`Card ${target.card.title} arquivado.`);
    focus.focusLaneLater(target.lane.id);
  }

  function duplicate(targetCardId: string) {
    if (blockedByLock({ cardId: targetCardId })) {
      return;
    }
    const target = findCard({ lanes, cardId: targetCardId });
    const copyId = commands.duplicateCard(targetCardId);
    if (target && copyId) {
      open(copyId);
      announce(`Card ${target.card.title} duplicado.`);
    }
  }

  return {
    location,
    visible,
    shownCardId: visible && cardId ? cardId : undefined,
    open,
    close,
    clear,
    archive,
    duplicate,
  };
}

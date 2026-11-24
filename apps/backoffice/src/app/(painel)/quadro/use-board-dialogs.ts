import { useRef, useState } from 'react';
import type { BoardCommands } from './board-commands';
import type { Announce } from './board-notices';
import type {
  BoardDialog,
  BoardDialogHandlers,
  BoardDialogRequest,
} from './dialogs/board-dialogs';
import type { LaneRemoval } from './dialogs/lane-dialogs';
import type { LockWarning } from './lock-warning';
import { type BoardLane, findCard } from './model/board';
import { childCounts } from './model/hierarchy';
import type { BoardFocus } from './use-board-focus';

interface CardRemovalParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}

/** Pedido de confirmação para excluir o card, com o que acontece com os filhos dele. */
function cardRemovalRequest(
  params: CardRemovalParams,
): BoardDialogRequest | undefined {
  const { lanes, cardId } = params;
  const location = findCard({ lanes, cardId });
  if (!location) {
    return undefined;
  }
  const { card } = location;
  const parentLocation = card.parentId
    ? findCard({ lanes, cardId: card.parentId })
    : undefined;
  return {
    kind: 'remove-card',
    card,
    childCount: childCounts(lanes).get(card.id) ?? 0,
    parentTitle: parentLocation?.card.title,
  };
}

interface FocusAfterRemovalParams {
  readonly lanes: readonly BoardLane[];
  readonly removal: LaneRemoval;
}

/** Coluna que recebe o foco quando outra é excluída: a que recebeu os cards ou, se não, uma vizinha. */
function laneToFocusAfterRemoval(
  params: FocusAfterRemovalParams,
): string | undefined {
  const { lanes, removal } = params;
  if (removal.moveCardsTo !== undefined) {
    return removal.moveCardsTo;
  }
  const index = lanes.findIndex((lane) => lane.id === removal.laneId);
  const neighbor = lanes[index - 1] ?? lanes[index + 1];
  return neighbor?.id;
}

export interface UseBoardDialogsParams {
  readonly lanes: readonly BoardLane[];
  readonly commands: Pick<
    BoardCommands,
    'setWipLimit' | 'removeLane' | 'removeCard' | 'reset'
  >;
  readonly announce: Announce;
  readonly focus: Pick<BoardFocus, 'focusMarked'>;
  readonly blockedByLock: LockWarning;
  /** O quadro voltou ao exemplo: quem guarda estado de um card aberto precisa largar. */
  readonly onReset: () => void;
}

export interface BoardDialogsState {
  readonly dialog: BoardDialog | null;
  readonly handlers: BoardDialogHandlers;
  readonly requestLimit: (laneId: string) => void;
  readonly requestLaneRemoval: (laneId: string) => void;
  readonly requestCardRemoval: (cardId: string) => void;
  readonly requestReset: () => void;
}

/** Janelas de confirmação do quadro: limite da coluna, exclusão de coluna ou card e restauração do exemplo. */
export function useBoardDialogs(
  params: UseBoardDialogsParams,
): BoardDialogsState {
  const { lanes, commands, announce, focus, blockedByLock, onReset } = params;
  const [dialog, setDialog] = useState<BoardDialog | null>(null);
  const openCount = useRef(0);

  function open(request: BoardDialogRequest) {
    openCount.current += 1;
    setDialog({ key: openCount.current, open: true, request });
  }

  /** Fecha a janela; quando ela termina de sair, o foco vai para o título de `focusLaneId`. */
  function close(focusLaneId: string | undefined) {
    setDialog((current) => current && { ...current, open: false, focusLaneId });
  }

  function findLane(laneId: string): BoardLane | undefined {
    return lanes.find((lane) => lane.id === laneId);
  }

  function requestLimit(laneId: string) {
    const lane = findLane(laneId);
    if (lane) {
      open({ kind: 'limit', lane });
    }
  }

  function requestLaneRemoval(laneId: string) {
    const lane = findLane(laneId);
    if (lane) {
      open({ kind: 'remove-lane', lane });
    }
  }

  function requestCardRemoval(cardId: string) {
    const request = cardRemovalRequest({ lanes, cardId });
    if (request && !blockedByLock({ cardId })) {
      open(request);
    }
  }

  /** Coluna da janela aberta, que volta a ter o foco quando a janela é cancelada. */
  function dialogLaneId(): string | undefined {
    const request = dialog?.request;
    if (request?.kind === 'limit' || request?.kind === 'remove-lane') {
      return request.lane.id;
    }
    return undefined;
  }

  const handlers: BoardDialogHandlers = {
    onSaveLimit: (change) => {
      commands.setWipLimit(change);
      close(change.laneId);
    },
    onRemoveLane: (removal) => {
      const lane = findLane(removal.laneId);
      commands.removeLane(removal);
      close(laneToFocusAfterRemoval({ lanes, removal }));
      announce(`Coluna ${lane?.title} excluída.`);
    },
    onRemoveCard: (cardId) => {
      const location = findCard({ lanes, cardId });
      commands.removeCard(cardId);
      close(location?.lane.id);
      announce(`Card ${location?.card.title} excluído.`);
    },
    onReset: () => {
      commands.reset();
      onReset();
      close(undefined);
      announce('Quadro de exemplo restaurado.');
    },
    onCancel: () => close(dialogLaneId()),
    onClosed: (focusLaneId) => {
      if (focusLaneId) {
        focus.focusMarked({ attribute: 'data-lane-title', id: focusLaneId });
      } else {
        focus.focusMarked({ attribute: 'data-board-reset', id: '' });
      }
    },
  };

  return {
    dialog,
    handlers,
    requestLimit,
    requestLaneRemoval,
    requestCardRemoval,
    requestReset: () => open({ kind: 'reset' }),
  };
}

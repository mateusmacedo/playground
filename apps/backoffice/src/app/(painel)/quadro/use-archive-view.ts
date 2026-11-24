import { useState } from 'react';
import type { BoardCommands } from './board-commands';
import type { Announce, Notify } from './board-notices';
import type { ArchivedView } from './dialogs/archived-card-dialog';
import { restoreArchived } from './model/archive';
import type { ArchiveEntry, Board } from './model/board';
import { brokenLock } from './model/lane-state';

export interface UseArchiveViewParams {
  readonly board: Board;
  readonly commands: Pick<BoardCommands, 'restoreArchived' | 'deleteArchived'>;
  readonly announce: Announce;
  readonly notify: Notify;
}

export interface ArchiveViewState {
  /** Card arquivado mostrado na janela; continua guardado enquanto a janela sai da tela. */
  readonly view: ArchivedView | null;
  readonly visible: boolean;
  readonly show: (view: ArchivedView) => void;
  /** Mostra o card arquivado pelo id dele; não faz nada se ele não está no arquivo. */
  readonly showCard: (cardId: string) => void;
  /** Mostra o card principal do arquivamento; devolve `false` se o arquivamento não existe. */
  readonly showEntry: (entryId: string) => boolean;
  readonly close: () => void;
  /** Restaura o arquivamento; devolve `false`, com aviso, quando ele voltaria para uma coluna bloqueada. */
  readonly restore: (entryId: string) => boolean;
  /** Exclui o arquivamento de vez. */
  readonly remove: (entryId: string) => void;
}

/** Janela do card arquivado (só leitura) e as ações sobre um arquivamento: restaurar e excluir de vez. */
export function useArchiveView(params: UseArchiveViewParams): ArchiveViewState {
  const { board, commands, announce, notify } = params;
  const [view, setView] = useState<ArchivedView | null>(null);
  const [visible, setVisible] = useState(false);

  function findEntry(entryId: string): ArchiveEntry | undefined {
    return board.archive.find((entry) => entry.id === entryId);
  }

  /** Título do card principal do arquivamento, para o anúncio. */
  function entryTitle(entryId: string): string {
    return findEntry(entryId)?.cards[0]?.card.title ?? '';
  }

  function show(next: ArchivedView) {
    setView(next);
    setVisible(true);
  }

  function showCard(cardId: string) {
    const entry = board.archive.find((candidate) =>
      candidate.cards.some((item) => item.card.id === cardId),
    );
    if (entry) {
      show({ entryId: entry.id, cardId });
    }
  }

  function showEntry(entryId: string): boolean {
    const mainCard = findEntry(entryId)?.cards[0]?.card;
    if (!mainCard) {
      return false;
    }
    show({ entryId, cardId: mainCard.id });
    return true;
  }

  function restore(entryId: string): boolean {
    const restored = restoreArchived({ board, entryId });
    const locked = brokenLock({ before: board.lanes, after: restored.lanes });
    if (locked) {
      notify({
        color: 'warning',
        text: `A coluna ${locked.title} está bloqueada: libere a coluna para restaurar o card nela.`,
      });
      return false;
    }
    const title = entryTitle(entryId);
    commands.restoreArchived(entryId);
    announce(`Card ${title} restaurado.`);
    return true;
  }

  function remove(entryId: string) {
    const title = entryTitle(entryId);
    commands.deleteArchived(entryId);
    announce(`Card ${title} excluído de vez.`);
  }

  return {
    view,
    visible,
    show,
    showCard,
    showEntry,
    close: () => setVisible(false),
    restore,
    remove,
  };
}

import type { BoardCommands } from './board-commands';
import { canCopyLinks, copyCardLink } from './card-link';
import { CardDetailsPanel } from './details/card-details-panel';
import { BoardDialogs } from './dialogs/board-dialogs';
import { BoardListDialogs } from './dialogs/board-list-dialogs';
import {
  type BoardSettings,
  BoardSettingsDialog,
} from './dialogs/board-settings-dialog';
import { findCard } from './model/board';
import type { BoardScreen } from './use-board-screen';

export interface BoardOverlaysProps {
  readonly screen: BoardScreen;
  /** Com ela, o quadro tem a janela "Configurar quadro". */
  readonly settings: BoardSettings | undefined;
  /** Nome de quem comenta nos cards. */
  readonly author: string;
}

/** O que abre por cima das colunas: o painel de detalhes do card e as janelas do quadro. */
export function BoardOverlays({
  screen,
  settings,
  author,
}: Readonly<BoardOverlaysProps>) {
  const { board, commands, feedback, focus, blockedByLock } = screen;
  const { panel, archiveView, dialogs, listDialogs } = screen.windows;

  function copyLink(cardId: string) {
    const location = findCard({ lanes: board.lanes, cardId });
    if (location) {
      copyCardLink({
        card: location.card,
        keyPrefix: board.config.keyPrefix,
        notify: feedback.notify,
      });
    }
  }

  // NOTE: o painel muda o card de coluna por um campo de seleção; a coluna bloqueada precisa barrar também esse caminho.
  const panelCommands: BoardCommands = {
    ...commands,
    moveCardToLane: (change) => {
      if (!blockedByLock(change)) {
        commands.moveCardToLane(change);
      }
    },
  };

  return (
    <>
      <CardDetailsPanel
        visible={panel.visible}
        location={panel.location}
        board={board}
        commands={panelCommands}
        actions={{
          onOpenCard: panel.open,
          onRequestRemove: dialogs.requestCardRemoval,
          onArchive: panel.archive,
          onDuplicate: panel.duplicate,
          onCopyLink: screen.isClient && canCopyLinks() ? copyLink : undefined,
          onAnnounce: feedback.announce,
        }}
        author={author}
        onClose={panel.close}
      />
      <BoardDialogs
        dialog={dialogs.dialog}
        lanes={board.lanes}
        handlers={dialogs.handlers}
      />
      <BoardListDialogs
        open={listDialogs.open}
        board={board}
        commands={commands}
        archiveView={archiveView}
        focus={focus}
        onClose={listDialogs.close}
      />
      {settings && listDialogs.settingsOpenCount > 0 ? (
        <BoardSettingsDialog
          key={listDialogs.settingsOpenCount}
          visible={listDialogs.open === 'settings'}
          settings={settings}
          board={board}
          configure={commands.configure}
          announce={feedback.announce}
          onClose={listDialogs.close}
          onClosed={() =>
            focus.focusMarked({ attribute: 'data-board-settings', id: '' })
          }
        />
      ) : null}
    </>
  );
}

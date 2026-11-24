import type { BoardCommands } from '../board-commands';
import type { Board } from '../model/board';
import type { ArchiveViewState } from '../use-archive-view';
import type { BoardFocus } from '../use-board-focus';
import type { ListDialogKind } from '../use-list-dialogs';
import { ArchiveDialog } from './archive-dialog';
import { ArchivedCardDialog } from './archived-card-dialog';
import { LabelsDialog } from './labels-dialog';

export interface BoardListDialogsProps {
  /** Janela aberta pela barra do quadro; só uma por vez. */
  readonly open: ListDialogKind | null;
  readonly board: Board;
  readonly commands: BoardCommands;
  readonly archiveView: ArchiveViewState;
  readonly focus: Pick<BoardFocus, 'focusMarked'>;
  readonly onClose: () => void;
}

/** Janelas de lista do quadro: os cards arquivados, o card arquivado aberto para leitura e as etiquetas. */
export function BoardListDialogs({
  open,
  board,
  commands,
  archiveView,
  focus,
  onClose,
}: Readonly<BoardListDialogsProps>) {
  const focusArchiveButton = () =>
    focus.focusMarked({ attribute: 'data-board-archive', id: '' });

  return (
    <>
      <ArchiveDialog
        visible={open === 'archive'}
        archive={board.archive}
        keyPrefix={board.config.keyPrefix}
        onView={(entryId) => {
          if (archiveView.showEntry(entryId)) {
            onClose();
          }
        }}
        onRestore={archiveView.restore}
        onDelete={archiveView.remove}
        onClose={onClose}
        onClosed={focusArchiveButton}
      />
      <ArchivedCardDialog
        visible={archiveView.visible}
        view={archiveView.view}
        board={board}
        onOpenCard={archiveView.show}
        onRestore={(entryId) => {
          if (archiveView.restore(entryId)) {
            archiveView.close();
          }
        }}
        onDelete={(entryId) => {
          archiveView.remove(entryId);
          archiveView.close();
        }}
        onClose={archiveView.close}
        onClosed={focusArchiveButton}
      />
      <LabelsDialog
        visible={open === 'labels'}
        labels={board.labels}
        commands={commands}
        onClose={onClose}
        onClosed={() =>
          focus.focusMarked({ attribute: 'data-board-labels', id: '' })
        }
      />
    </>
  );
}

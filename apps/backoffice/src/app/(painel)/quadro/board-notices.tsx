import { CAlert } from '@coreui/react';

import { BoardSaveNotice } from './board-save-notice';
import type { SaveStatus } from './store/board-store';
import type { SaveActions } from './use-board-storage';

/**
 * Aviso visível acima do quadro: link copiado, card do endereço que não pode ser aberto, coluna bloqueada e mudança
 * que as regras do quadro recusaram.
 */
export interface Notice {
  readonly color: 'success' | 'warning';
  readonly text: string;
}

export type Notify = (notice: Notice) => void;

/** Texto lido pelo leitor de tela a cada mudança do quadro. */
export type Announce = (text: string) => void;

export interface BoardNoticesProps {
  /** Situação da gravação do quadro. */
  readonly save: SaveStatus;
  /** As saídas da gravação num servidor; sem elas, o quadro fica no navegador. */
  readonly saveActions?: SaveActions;
  readonly notice: Notice | null;
  readonly onDismiss: () => void;
}

/** Avisos acima do quadro: a gravação que não deu certo e o aviso da última ação. */
export function BoardNotices({
  save,
  saveActions,
  notice,
  onDismiss,
}: Readonly<BoardNoticesProps>) {
  return (
    <>
      <BoardSaveNotice save={save} actions={saveActions} />
      {notice ? (
        <CAlert
          color={notice.color}
          dismissible
          className="py-2"
          onClose={onDismiss}
        >
          {notice.text}
        </CAlert>
      ) : null}
    </>
  );
}

import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react';
import { useId } from 'react';

import type { Board } from '../model/board';
import { cardKey } from '../model/card-key';
import { ArchivedCardContent } from './archived-card-content';
import { OnClosed } from './on-closed';

/** Card arquivado aberto só para leitura; restaurar e excluir valem para o arquivamento inteiro. */
export interface ArchivedView {
  readonly entryId: string;
  readonly cardId: string;
}

export interface ArchivedCardDialogProps {
  readonly visible: boolean;
  readonly view: ArchivedView | null;
  readonly board: Board;
  /** Abre outro card do mesmo arquivamento. */
  readonly onOpenCard: (view: ArchivedView) => void;
  readonly onRestore: (entryId: string) => void;
  readonly onDelete: (entryId: string) => void;
  readonly onClose: () => void;
  /** A janela terminou de fechar. */
  readonly onClosed: () => void;
}

/**
 * Mostra um card arquivado sem deixar editar: dados, etiquetas, checklist, os cards que foram arquivados com ele e o
 * histórico. Restaurar devolve o arquivamento inteiro ao quadro.
 */
export function ArchivedCardDialog({
  visible,
  view,
  board,
  onOpenCard,
  onRestore,
  onDelete,
  onClose,
  onClosed,
}: Readonly<ArchivedCardDialogProps>) {
  const titleId = useId();
  const entry = board.archive.find(
    (candidate) => candidate.id === view?.entryId,
  );
  const item = entry?.cards.find(({ card }) => card.id === view?.cardId);
  const title = item
    ? `Card arquivado ${cardKey({ card: item.card, prefix: board.config.keyPrefix })}`
    : 'Card arquivado';
  const restoreLabel =
    entry && entry.cards.length > 1 ? 'Restaurar com o grupo' : 'Restaurar';

  return (
    <CModal
      visible={visible && item !== undefined}
      size="lg"
      scrollable
      aria-labelledby={titleId}
      onClose={() => {
        if (visible) {
          onClose();
        }
      }}
    >
      <CModalHeader>
        <CModalTitle id={titleId}>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {entry && item ? (
          <ArchivedCardContent
            entry={entry}
            item={item}
            board={board}
            onOpenCard={(cardId) => onOpenCard({ entryId: entry.id, cardId })}
          />
        ) : null}
        <OnClosed
          onClosed={() => {
            if (!visible) {
              onClosed();
            }
          }}
        />
      </CModalBody>
      <CModalFooter>
        {entry ? (
          <>
            <CButton
              type="button"
              color="danger"
              variant="ghost"
              className="me-auto"
              onClick={() => onDelete(entry.id)}
            >
              Excluir de vez
            </CButton>
            <CButton
              type="button"
              color="primary"
              onClick={() => onRestore(entry.id)}
            >
              {restoreLabel}
            </CButton>
          </>
        ) : null}
        <CButton type="button" color="secondary" onClick={onClose}>
          Fechar
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

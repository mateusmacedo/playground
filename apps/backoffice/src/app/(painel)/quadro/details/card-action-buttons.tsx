import { cilClone, cilInbox, cilLayers, cilTrash } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton } from '@coreui/react';

export interface CardActionButtonsProps {
  readonly cardId: string;
  readonly onDuplicate: (cardId: string) => void;
  /** Duplica o card com todos os descendentes; sem ela (card sem filhos), o botão não aparece. */
  readonly onDuplicateTree?: (cardId: string) => void;
  readonly onArchive: (cardId: string) => void;
  readonly onRequestRemove: (cardId: string) => void;
}

/** Ações do card no pé do painel: duplicar (só ele ou com os filhos), arquivar e excluir. */
export function CardActionButtons({
  cardId,
  onDuplicate,
  onDuplicateTree,
  onArchive,
  onRequestRemove,
}: Readonly<CardActionButtonsProps>) {
  return (
    <div className="d-flex flex-wrap gap-2 border-top pt-3">
      <CButton
        type="button"
        color="secondary"
        variant="outline"
        size="sm"
        onClick={() => onDuplicate(cardId)}
      >
        <CIcon icon={cilClone} aria-hidden="true" className="me-1" />
        Duplicar card
      </CButton>
      {onDuplicateTree ? (
        <CButton
          type="button"
          color="secondary"
          variant="outline"
          size="sm"
          onClick={() => onDuplicateTree(cardId)}
        >
          <CIcon icon={cilLayers} aria-hidden="true" className="me-1" />
          Duplicar com filhos
        </CButton>
      ) : null}
      <CButton
        type="button"
        color="secondary"
        variant="outline"
        size="sm"
        onClick={() => onArchive(cardId)}
      >
        <CIcon icon={cilInbox} aria-hidden="true" className="me-1" />
        Arquivar card
      </CButton>
      <CButton
        type="button"
        color="danger"
        variant="outline"
        size="sm"
        onClick={() => onRequestRemove(cardId)}
      >
        <CIcon icon={cilTrash} aria-hidden="true" className="me-1" />
        Excluir card
      </CButton>
    </div>
  );
}

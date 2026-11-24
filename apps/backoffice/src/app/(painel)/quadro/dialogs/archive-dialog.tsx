import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react';
import { useId } from 'react';

import type { ArchiveEntry } from '../model/board';
import { cardKey } from '../model/card-key';
import { OnClosed } from './on-closed';

const moment = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

interface ArchiveItemProps {
  readonly entry: ArchiveEntry;
  readonly keyPrefix: string;
  readonly onView?: (entryId: string) => void;
  readonly onRestore: (entryId: string) => void;
  readonly onDelete: (entryId: string) => void;
}

function ArchiveItem({
  entry,
  keyPrefix,
  onView,
  onRestore,
  onDelete,
}: Readonly<ArchiveItemProps>) {
  const root = entry.cards[0]?.card;
  if (!root) {
    return null;
  }
  const children = entry.cards.length - 1;
  const date = new Date(entry.archivedAt);
  return (
    <li className="d-flex flex-wrap align-items-center justify-content-between gap-2 border rounded p-2">
      <div>
        <span className="badge bg-body-secondary text-body border me-2">
          {cardKey({ card: root, prefix: keyPrefix })}
        </span>
        <strong>{root.title}</strong>
        {children > 0 ? (
          <span className="small text-body-secondary">
            {' '}
            e {children} {children === 1 ? 'card filho' : 'cards filhos'}
          </span>
        ) : null}
        {Number.isNaN(date.getTime()) ? null : (
          <div className="small text-body-secondary">
            Arquivado em {moment.format(date)}
          </div>
        )}
      </div>
      <div className="d-flex gap-2">
        {onView ? (
          <CButton
            type="button"
            color="secondary"
            variant="ghost"
            size="sm"
            aria-label={`Ver ${root.title}`}
            onClick={() => onView(entry.id)}
          >
            Ver
          </CButton>
        ) : null}
        <CButton
          type="button"
          color="primary"
          variant="outline"
          size="sm"
          aria-label={`Restaurar ${root.title}`}
          onClick={() => onRestore(entry.id)}
        >
          Restaurar
        </CButton>
        <CButton
          type="button"
          color="danger"
          variant="ghost"
          size="sm"
          aria-label={`Excluir de vez ${root.title}`}
          onClick={() => onDelete(entry.id)}
        >
          Excluir de vez
        </CButton>
      </div>
    </li>
  );
}

export interface ArchiveDialogProps {
  readonly visible: boolean;
  readonly archive: readonly ArchiveEntry[];
  /** Prefixo do código dos cards do quadro. */
  readonly keyPrefix: string;
  /** Abre o card arquivado só para leitura. */
  readonly onView?: (entryId: string) => void;
  readonly onRestore: (entryId: string) => void;
  readonly onDelete: (entryId: string) => void;
  readonly onClose: () => void;
  /** A janela terminou de fechar. */
  readonly onClosed: () => void;
}

/** Lista dos cards arquivados, com restaurar e excluir de vez; as duas ações podem ser desfeitas. */
export function ArchiveDialog({
  visible,
  archive,
  keyPrefix,
  onView,
  onRestore,
  onDelete,
  onClose,
  onClosed,
}: Readonly<ArchiveDialogProps>) {
  const titleId = useId();
  return (
    <CModal
      visible={visible}
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
        <CModalTitle id={titleId}>Cards arquivados</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {archive.length === 0 ? (
          <p className="mb-0 text-body-secondary">Nenhum card arquivado.</p>
        ) : (
          <ul className="list-unstyled d-grid gap-2 mb-0">
            {archive.map((entry) => (
              <ArchiveItem
                key={entry.id}
                entry={entry}
                keyPrefix={keyPrefix}
                onView={onView}
                onRestore={onRestore}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
        <OnClosed
          onClosed={() => {
            if (!visible) {
              onClosed();
            }
          }}
        />
      </CModalBody>
      <CModalFooter>
        <CButton type="button" color="secondary" onClick={onClose}>
          Fechar
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

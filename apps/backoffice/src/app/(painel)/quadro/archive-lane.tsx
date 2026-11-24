import { cilInbox, cilLowVision } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { type DragEvent, useId } from 'react';

import type { ArchivedView } from './dialogs/archived-card-dialog';
import type { ArchiveEntry } from './model/board';
import { cardKey } from './model/card-key';

/**
 * Coluna automática, sempre a última, com os arquivamentos do mais recente para o mais antigo. Abrir um item mostra o
 * card só para leitura; soltar um card arrastado nela arquiva o card com os descendentes.
 */
export function ArchiveLane({
  archive,
  keyPrefix,
  dropActive,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpen,
  onHide,
}: Readonly<{
  archive: readonly ArchiveEntry[];
  keyPrefix: string;
  /** Um card arrastado está sobre a coluna e será arquivado ao soltar. */
  dropActive: boolean;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onOpen: (view: ArchivedView) => void;
  onHide: () => void;
}>) {
  const titleId = useId();
  return (
    <section
      className={`card kanban-lane kanban-lane--archive bg-body-tertiary${dropActive ? ' kanban-lane--drop-target' : ''}`}
      aria-labelledby={titleId}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="card-header d-flex align-items-center gap-2 px-2">
        <CIcon icon={cilInbox} aria-hidden="true" />
        <h2
          id={titleId}
          tabIndex={-1}
          data-archive-lane=""
          className="h6 mb-0 flex-grow-1 text-truncate"
        >
          Arquivados
        </h2>
        <span className="badge text-bg-secondary">
          {archive.length}
          <span className="visually-hidden">
            {archive.length === 1 ? ' arquivamento' : ' arquivamentos'}
          </span>
        </span>
        <button
          type="button"
          className="btn btn-sm btn-ghost-secondary"
          aria-label="Ocultar a coluna Arquivados"
          title="Ocultar a coluna"
          onClick={onHide}
        >
          <CIcon icon={cilLowVision} aria-hidden="true" />
        </button>
      </header>
      <div className="card-body kanban-lane__body p-2">
        {archive.length === 0 ? (
          <p className="small text-body-secondary text-center mb-0 py-3">
            Nenhum card arquivado. Arraste um card para cá para arquivar.
          </p>
        ) : (
          <ul className="list-unstyled mb-0">
            {archive.map((entry) => {
              const root = entry.cards[0]?.card;
              if (!root) {
                return null;
              }
              const children = entry.cards.length - 1;
              return (
                <li key={entry.id} className="card kanban-card mb-2">
                  <button
                    type="button"
                    className="btn btn-sm text-start p-2 w-100"
                    aria-label={`Ver ${root.title}, arquivado`}
                    onClick={() =>
                      onOpen({ entryId: entry.id, cardId: root.id })
                    }
                  >
                    <span className="kanban-card__key small text-body-secondary d-block">
                      {cardKey({ card: root, prefix: keyPrefix })}
                    </span>
                    <span className="d-block text-decoration-line-through text-body-secondary">
                      {root.title}
                    </span>
                    {children > 0 ? (
                      <span className="small text-body-secondary">
                        e {children}{' '}
                        {children === 1 ? 'card filho' : 'cards filhos'}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

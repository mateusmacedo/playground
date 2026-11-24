import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react';
import { useId } from 'react';

import { ActivityList } from '../details/activity-list';
import type { ArchiveEntry, Board } from '../model/board';
import { cardKey } from '../model/card-key';
import { formatFullDate } from '../model/due';
import { cardLabels } from '../model/labels';
import { OnClosed } from './on-closed';

const moment = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/** Card arquivado aberto só para leitura; restaurar e excluir valem para o arquivamento inteiro. */
export interface ArchivedView {
  readonly entryId: string;
  readonly cardId: string;
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
}: Readonly<{
  visible: boolean;
  view: ArchivedView | null;
  board: Board;
  /** Abre outro card do mesmo arquivamento. */
  onOpenCard: (view: ArchivedView) => void;
  onRestore: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onClose: () => void;
  /** A janela terminou de fechar. */
  onClosed: () => void;
}>) {
  const titleId = useId();
  const entry: ArchiveEntry | undefined = board.archive.find(
    (candidate) => candidate.id === view?.entryId,
  );
  const item = entry?.cards.find(({ card }) => card.id === view?.cardId);
  const { keyPrefix } = board.config;
  const others = entry?.cards.filter((candidate) => candidate !== item) ?? [];
  const laneTitle = (laneId: string) =>
    board.lanes.find((lane) => lane.id === laneId)?.title;

  return (
    <CModal
      visible={visible && Boolean(item)}
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
        <CModalTitle id={titleId}>
          {item
            ? `Card arquivado ${cardKey({ card: item.card, prefix: keyPrefix })}`
            : 'Card arquivado'}
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        {entry && item ? (
          <div className="d-grid gap-3">
            <div>
              <h3 className="h5 mb-1">{item.card.title}</h3>
              <p className="small text-body-secondary mb-0">
                Arquivado em {moment.format(new Date(entry.archivedAt))}
                {laneTitle(item.laneId)
                  ? `, na coluna ${laneTitle(item.laneId)}`
                  : ''}
                . Só leitura: restaure para editar.
              </p>
            </div>
            {item.card.description ? (
              <p className="mb-0 kanban-archived__description">
                {item.card.description}
              </p>
            ) : null}
            <ArchivedData entry={entry} cardId={item.card.id} board={board} />
            {others.length > 0 ? (
              <section aria-label="Arquivados junto">
                <h4 className="h6">Arquivados junto</h4>
                <ul className="list-unstyled d-grid gap-1 mb-0">
                  {others.map(({ card }) => (
                    <li key={card.id}>
                      <CButton
                        type="button"
                        color="link"
                        size="sm"
                        className="p-0 text-start"
                        onClick={() =>
                          onOpenCard({ entryId: entry.id, cardId: card.id })
                        }
                      >
                        {cardKey({ card, prefix: keyPrefix })} {card.title}
                      </CButton>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {item.card.activity?.length ? (
              <section aria-label="Histórico">
                <h4 className="h6">Histórico</h4>
                <ActivityList activity={item.card.activity} />
              </section>
            ) : null}
          </div>
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
              {entry.cards.length > 1 ? 'Restaurar com o grupo' : 'Restaurar'}
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

/** Etiquetas, prazo e checklist do card arquivado, em texto. */
function ArchivedData({
  entry,
  cardId,
  board,
}: Readonly<{ entry: ArchiveEntry; cardId: string; board: Board }>) {
  const card = entry.cards.find((item) => item.card.id === cardId)?.card;
  if (!card) {
    return null;
  }
  const labels = cardLabels({ card, labels: board.labels });
  const checklist = card.checklist ?? [];
  return (
    <dl className="row mb-0 small">
      {labels.length > 0 ? (
        <>
          <dt className="col-sm-3">Etiquetas</dt>
          <dd className="col-sm-9">
            {labels.map((label) => (
              <span
                key={label.id}
                className={`badge text-bg-${label.color} me-1`}
              >
                {label.name}
              </span>
            ))}
          </dd>
        </>
      ) : null}
      {card.dueDate ? (
        <>
          <dt className="col-sm-3">Prazo</dt>
          <dd className="col-sm-9">
            {formatFullDate(card.dueDate)}
            {card.dueDone ? ' (concluído)' : ''}
          </dd>
        </>
      ) : null}
      {checklist.length > 0 ? (
        <>
          <dt className="col-sm-3">Checklist</dt>
          <dd className="col-sm-9">
            <ul className="list-unstyled mb-0">
              {checklist.map((checkItem) => (
                <li key={checkItem.id}>
                  {checkItem.done ? '☑' : '☐'} {checkItem.text}
                  <span className="visually-hidden">
                    {checkItem.done ? ', feito' : ', pendente'}
                  </span>
                </li>
              ))}
            </ul>
          </dd>
        </>
      ) : null}
    </dl>
  );
}

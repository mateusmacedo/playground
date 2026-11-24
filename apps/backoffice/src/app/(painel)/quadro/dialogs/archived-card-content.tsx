import { CButton } from '@coreui/react';

import { ActivityList } from '../details/activity-list';
import type {
  ArchivedCard,
  ArchiveEntry,
  Board,
  BoardCard,
  BoardLabel,
} from '../model/board';
import { cardKey } from '../model/card-key';
import { formatFullDate } from '../model/due';
import { cardLabels } from '../model/labels';

const moment = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export interface ArchivedCardContentProps {
  /** Arquivamento a que o card pertence. */
  readonly entry: ArchiveEntry;
  /** Card mostrado, com a coluna de onde ele saiu. */
  readonly item: ArchivedCard;
  readonly board: Board;
  /** Abre outro card do mesmo arquivamento. */
  readonly onOpenCard: (cardId: string) => void;
}

/** Conteúdo do card arquivado, só para leitura: resumo, dados, os cards arquivados junto e o histórico. */
export function ArchivedCardContent({
  entry,
  item,
  board,
  onOpenCard,
}: Readonly<ArchivedCardContentProps>) {
  const { card } = item;
  const { keyPrefix } = board.config;
  const laneTitle = board.lanes.find((lane) => lane.id === item.laneId)?.title;
  const archivedTogether = entry.cards.filter((other) => other !== item);
  const activity = card.activity ?? [];

  return (
    <div className="d-grid gap-3">
      <div>
        <h3 className="h5 mb-1">{card.title}</h3>
        <p className="small text-body-secondary mb-0">
          Arquivado em {moment.format(new Date(entry.archivedAt))}
          {laneTitle ? `, na coluna ${laneTitle}` : ''}. Só leitura: restaure
          para editar.
        </p>
      </div>
      {card.description ? (
        <p className="mb-0 kanban-archived__description">{card.description}</p>
      ) : null}
      <ArchivedData
        card={card}
        labels={cardLabels({ card, labels: board.labels })}
      />
      {archivedTogether.length > 0 ? (
        <section aria-label="Arquivados junto">
          <h4 className="h6">Arquivados junto</h4>
          <ul className="list-unstyled d-grid gap-1 mb-0">
            {archivedTogether.map((other) => (
              <li key={other.card.id}>
                <CButton
                  type="button"
                  color="link"
                  size="sm"
                  className="p-0 text-start"
                  onClick={() => onOpenCard(other.card.id)}
                >
                  {cardKey({ card: other.card, prefix: keyPrefix })}{' '}
                  {other.card.title}
                </CButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {activity.length > 0 ? (
        <section aria-label="Histórico">
          <h4 className="h6">Histórico</h4>
          <ActivityList activity={activity} />
        </section>
      ) : null}
    </div>
  );
}

interface ArchivedDataProps {
  readonly card: BoardCard;
  /** Etiquetas do card que ainda existem no quadro. */
  readonly labels: readonly BoardLabel[];
}

/** Etiquetas, prazo e checklist do card arquivado, em texto. */
function ArchivedData({ card, labels }: Readonly<ArchivedDataProps>) {
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

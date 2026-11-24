import { cilClone, cilInbox, cilLink, cilTrash } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormInput, CFormSelect, CFormTextarea } from '@coreui/react';
import { useId, useState } from 'react';

import { InlineAddForm } from '../inline-add-form';
import { type Board, type CardLocation, findCard } from '../model/board';
import { cardKey } from '../model/card-key';
import { childProgress, progressText } from '../model/completion';
import { ancestorsOf, childrenOf, parentCandidates } from '../model/hierarchy';
import type { BoardCommands } from '../use-board';
import { ActivityList } from './activity-list';
import { AttachmentsSection } from './attachments-section';
import { ChecklistSection } from './checklist-section';
import { CommentsSection } from './comments-section';
import { DueField } from './due-field';
import { LabelsField } from './labels-field';

/** Ações do card que passam pelo quadro (confirmação, foco, anúncio). */
export interface CardDetailsActions {
  readonly onOpenCard: (cardId: string) => void;
  readonly onRequestRemove: (cardId: string) => void;
  readonly onArchive: (cardId: string) => void;
  readonly onDuplicate: (cardId: string) => void;
  /** Sem a área de transferência no navegador, o botão de copiar o link não aparece. */
  readonly onCopyLink?: (cardId: string) => void;
}

export interface CardDetailsProps {
  readonly location: CardLocation;
  readonly board: Board;
  readonly commands: BoardCommands;
  /** Nome de quem comenta. */
  readonly author: string;
  readonly actions: CardDetailsActions;
}

/** Título do card com rascunho: o vazio não chega ao quadro, e uma mudança de fora (o desfazer) substitui o rascunho. */
function TitleField({
  id,
  cardId,
  title,
  commands,
}: Readonly<{
  id: string;
  cardId: string;
  title: string;
  commands: Pick<BoardCommands, 'updateCard'>;
}>) {
  const [draft, setDraft] = useState(title);
  const [seen, setSeen] = useState(title);
  if (seen !== title) {
    setSeen(title);
    if (draft.trim() !== title) {
      setDraft(title);
    }
  }
  return (
    <CFormInput
      id={id}
      label="Título"
      value={draft}
      invalid={!draft.trim()}
      feedbackInvalid="O título não pode ficar vazio."
      onChange={(event) => {
        setDraft(event.target.value);
        commands.updateCard({ cardId, patch: { title: event.target.value } });
      }}
      onBlur={() => setDraft(title)}
    />
  );
}

/** Formulário do card aberto: texto, dados, coluna, hierarquia, histórico e as ações do card. */
export function CardDetails({
  location,
  board,
  commands,
  actions,
  author,
}: Readonly<CardDetailsProps>) {
  const { card, lane } = location;
  const { lanes } = board;
  const cardId = card.id;
  const fieldId = useId();
  const childrenHeadingId = useId();
  const path = [...ancestorsOf({ lanes, cardId })].reverse();
  const children = childrenOf({ lanes, cardId });
  const candidates = parentCandidates({ lanes, cardId });
  const laneTitle = (id: string) => findCard({ lanes, cardId: id })?.lane.title;
  const progress = childProgress({
    lanes,
    doneLaneId: board.config.doneLaneId,
  }).get(cardId);
  const people = board.config.people ?? [];

  return (
    <div className="d-grid gap-3">
      <div className="d-flex align-items-center justify-content-between gap-2">
        <span className="badge bg-body-secondary text-body border fs-6">
          {cardKey({ card, prefix: board.config.keyPrefix })}
        </span>
        {actions.onCopyLink ? (
          <CButton
            type="button"
            color="secondary"
            variant="ghost"
            size="sm"
            onClick={() => actions.onCopyLink?.(cardId)}
          >
            <CIcon icon={cilLink} aria-hidden="true" className="me-1" />
            Copiar link
          </CButton>
        ) : null}
      </div>
      {path.length > 0 ? (
        <nav aria-label="Caminho do card na hierarquia">
          <ol className="breadcrumb small mb-0">
            {path.map((ancestor) => (
              <li key={ancestor.id} className="breadcrumb-item">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 align-baseline"
                  onClick={() => actions.onOpenCard(ancestor.id)}
                >
                  {ancestor.title}
                </button>
              </li>
            ))}
            <li className="breadcrumb-item active">{card.title}</li>
          </ol>
        </nav>
      ) : null}
      <TitleField
        id={`${fieldId}-title`}
        cardId={cardId}
        title={card.title}
        commands={commands}
      />
      <CFormTextarea
        id={`${fieldId}-description`}
        label="Descrição"
        rows={4}
        value={card.description ?? ''}
        onChange={(event) =>
          commands.updateCard({
            cardId,
            patch: { description: event.target.value },
          })
        }
      />
      <LabelsField card={card} labels={board.labels} commands={commands} />
      <CFormSelect
        id={`${fieldId}-assignee`}
        label="Responsável"
        value={card.assigneeId ?? ''}
        text={
          people.length === 0
            ? 'Cadastre as pessoas do quadro em "Configurar quadro".'
            : undefined
        }
        onChange={(event) =>
          commands.setAssignee({
            cardId,
            assigneeId: event.target.value || undefined,
          })
        }
      >
        <option value="">Ninguém</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </CFormSelect>
      <DueField card={card} commands={commands} />
      <ChecklistSection card={card} commands={commands} />
      <CFormSelect
        id={`${fieldId}-lane`}
        label="Coluna"
        value={lane.id}
        onChange={(event) =>
          commands.moveCardToLane({ cardId, laneId: event.target.value })
        }
      >
        {lanes.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </CFormSelect>
      <CFormSelect
        id={`${fieldId}-parent`}
        label="Card pai"
        value={card.parentId ?? ''}
        onChange={(event) =>
          commands.setParent({
            cardId,
            parentId: event.target.value || undefined,
          })
        }
      >
        <option value="">Nenhum</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.title} ({laneTitle(candidate.id)})
          </option>
        ))}
      </CFormSelect>
      <section aria-labelledby={childrenHeadingId}>
        <h3 id={childrenHeadingId} className="h6">
          Cards filhos
          {progress ? (
            <span className="fw-normal text-body-secondary">
              {' '}
              ({progressText(progress)})
            </span>
          ) : null}
        </h3>
        {children.length > 0 ? (
          <ul className="list-unstyled d-grid gap-1 mb-2">
            {children.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  className="btn btn-link p-0 text-start align-baseline"
                  onClick={() => actions.onOpenCard(child.id)}
                >
                  {child.title}
                </button>{' '}
                <span className="small text-body-secondary">
                  ({laneTitle(child.id)})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small text-body-secondary mb-2">Nenhum card filho.</p>
        )}
        <InlineAddForm
          buttonLabel="Criar card filho"
          inputLabel={`Título do novo card filho, na coluna ${lane.title}`}
          keepOpen
          onAdd={(title) =>
            commands.addCard({ laneId: lane.id, title, parentId: cardId })
          }
        />
      </section>
      <AttachmentsSection card={card} commands={commands} />
      <CommentsSection card={card} author={author} commands={commands} />
      <ActivityList activity={card.activity ?? []} />
      <div className="d-flex flex-wrap gap-2 border-top pt-3">
        <CButton
          type="button"
          color="secondary"
          variant="outline"
          size="sm"
          onClick={() => actions.onDuplicate(cardId)}
        >
          <CIcon icon={cilClone} aria-hidden="true" className="me-1" />
          Duplicar card
        </CButton>
        <CButton
          type="button"
          color="secondary"
          variant="outline"
          size="sm"
          onClick={() => actions.onArchive(cardId)}
        >
          <CIcon icon={cilInbox} aria-hidden="true" className="me-1" />
          Arquivar card
        </CButton>
        <CButton
          type="button"
          color="danger"
          variant="outline"
          size="sm"
          onClick={() => actions.onRequestRemove(cardId)}
        >
          <CIcon icon={cilTrash} aria-hidden="true" className="me-1" />
          Excluir card
        </CButton>
      </div>
    </div>
  );
}

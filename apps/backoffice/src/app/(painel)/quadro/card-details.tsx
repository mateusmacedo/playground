import { cilTrash } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormInput, CFormSelect, CFormTextarea } from '@coreui/react';
import { useId, useState } from 'react';

import { InlineAddForm } from './inline-add-form';
import { type BoardLane, type CardLocation, findCard } from './model/board';
import { ancestorsOf, childrenOf, parentCandidates } from './model/hierarchy';
import type { BoardCommands } from './use-board';

export type CardDetailsCommands = Pick<
  BoardCommands,
  'updateCard' | 'moveCardToLane' | 'setParent' | 'addCard'
>;

export interface CardDetailsProps {
  readonly location: CardLocation;
  readonly lanes: readonly BoardLane[];
  readonly commands: CardDetailsCommands;
  readonly onOpenCard: (cardId: string) => void;
  readonly onRequestRemove: (cardId: string) => void;
}

/** Formulário do card aberto: texto, coluna, hierarquia (pai, caminho e filhos) e exclusão. */
export function CardDetails({
  location,
  lanes,
  commands,
  onOpenCard,
  onRequestRemove,
}: Readonly<CardDetailsProps>) {
  const { card, lane } = location;
  const cardId = card.id;
  // NOTE: o título vazio não chega ao quadro; o rascunho guarda o que está no campo até ele perder o foco.
  const [titleDraft, setTitleDraft] = useState(card.title);
  const fieldId = useId();
  const childrenHeadingId = useId();
  const path = [...ancestorsOf({ lanes, cardId })].reverse();
  const children = childrenOf({ lanes, cardId });
  const candidates = parentCandidates({ lanes, cardId });
  const laneTitle = (id: string) => findCard({ lanes, cardId: id })?.lane.title;

  return (
    <div className="d-grid gap-3">
      {path.length > 0 ? (
        <nav aria-label="Caminho do card na hierarquia">
          <ol className="breadcrumb small mb-0">
            {path.map((ancestor) => (
              <li key={ancestor.id} className="breadcrumb-item">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 align-baseline"
                  onClick={() => onOpenCard(ancestor.id)}
                >
                  {ancestor.title}
                </button>
              </li>
            ))}
            <li className="breadcrumb-item active">{card.title}</li>
          </ol>
        </nav>
      ) : null}
      <CFormInput
        id={`${fieldId}-title`}
        label="Título"
        value={titleDraft}
        invalid={!titleDraft.trim()}
        feedbackInvalid="O título não pode ficar vazio."
        onChange={(event) => {
          setTitleDraft(event.target.value);
          commands.updateCard({ cardId, patch: { title: event.target.value } });
        }}
        onBlur={() => setTitleDraft(card.title)}
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
        </h3>
        {children.length > 0 ? (
          <ul className="list-unstyled d-grid gap-1 mb-2">
            {children.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  className="btn btn-link p-0 text-start align-baseline"
                  onClick={() => onOpenCard(child.id)}
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
      <div>
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
    </div>
  );
}

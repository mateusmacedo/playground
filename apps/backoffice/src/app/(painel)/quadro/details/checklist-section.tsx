import { cilX } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormCheck, CProgress } from '@coreui/react';
import { useId } from 'react';
import type { BoardCommands } from '../board-commands';
import { InlineAddForm } from '../inline-add-form';
import type { BoardCard } from '../model/board';
import { checklistProgress } from '../model/checklist';

export interface ChecklistSectionProps {
  readonly card: BoardCard;
  readonly commands: Pick<
    BoardCommands,
    'addChecklistItem' | 'toggleChecklistItem' | 'removeChecklistItem'
  >;
}

/** Checklist do card: progresso, itens para marcar ou remover e a inclusão de itens. */
export function ChecklistSection({
  card,
  commands,
}: Readonly<ChecklistSectionProps>) {
  const id = useId();
  const items = card.checklist ?? [];
  const { done, total } = checklistProgress(card);
  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="d-flex align-items-center justify-content-between">
        <h3 id={`${id}-title`} className="h6 mb-1">
          Checklist
        </h3>
        {total > 0 ? (
          <span className="small text-body-secondary">
            {done} de {total}
          </span>
        ) : null}
      </div>
      {total > 0 ? (
        <>
          <CProgress
            thin
            className="mb-2"
            color={done === total ? 'success' : 'primary'}
            value={Math.round((done / total) * 100)}
            aria-label={`${done} de ${total} itens feitos`}
          />
          <ul className="list-unstyled d-grid gap-1 mb-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="d-flex align-items-start justify-content-between gap-2"
              >
                <CFormCheck
                  id={`${id}-${item.id}`}
                  label={item.text}
                  checked={item.done}
                  onChange={() =>
                    commands.toggleChecklistItem({
                      cardId: card.id,
                      itemId: item.id,
                    })
                  }
                />
                <CButton
                  type="button"
                  color="secondary"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remover o item ${item.text}`}
                  onClick={() =>
                    commands.removeChecklistItem({
                      cardId: card.id,
                      itemId: item.id,
                    })
                  }
                >
                  <CIcon icon={cilX} aria-hidden="true" />
                </CButton>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <InlineAddForm
        buttonLabel="Adicionar item"
        inputLabel="Texto do novo item do checklist"
        keepOpen
        onAdd={(text) => commands.addChecklistItem({ cardId: card.id, text })}
      />
    </section>
  );
}

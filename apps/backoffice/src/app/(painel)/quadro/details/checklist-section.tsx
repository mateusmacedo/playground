import { cilSitemap, cilX } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CProgress } from '@coreui/react';
import { useId, useRef } from 'react';
import { flushSync } from 'react-dom';
import { CheckField } from '@/shared/ui/check-field';
import type { BoardCommands } from '../board-commands';
import type { Announce } from '../board-notices';
import { InlineAddForm } from '../inline-add-form';
import type { BoardCard, ChecklistItem } from '../model/board';
import { checklistProgress } from '../model/checklist';

export interface ChecklistSectionProps {
  readonly card: BoardCard;
  readonly commands: Pick<
    BoardCommands,
    | 'addChecklistItem'
    | 'toggleChecklistItem'
    | 'removeChecklistItem'
    | 'convertChecklistItem'
  >;
  /** Diz ao leitor de tela que o item virou card filho. */
  readonly onAnnounce?: Announce;
}

/** Checklist do card: progresso, itens para marcar, remover ou converter em card filho, e a inclusão de itens. */
export function ChecklistSection({
  card,
  commands,
  onAnnounce,
}: Readonly<ChecklistSectionProps>) {
  const id = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const items = card.checklist ?? [];
  const { done, total } = checklistProgress(card);

  function convert(item: ChecklistItem) {
    // WHY: o item convertido sai da lista com o botão que estava em foco; o título da seção recebe o foco depois que
    // a lista é redesenhada, para ele não se perder.
    const childId = flushSync(() =>
      commands.convertChecklistItem({ cardId: card.id, itemId: item.id }),
    );
    if (childId === undefined) {
      return;
    }
    onAnnounce?.(`Item ${item.text} convertido em card filho.`);
    titleRef.current?.focus();
  }

  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="d-flex align-items-center justify-content-between">
        <h3 ref={titleRef} id={`${id}-title`} className="h6 mb-1" tabIndex={-1}>
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
                <CheckField
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
                <span className="d-flex flex-shrink-0">
                  <CButton
                    type="button"
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    title="Converter em card filho"
                    aria-label={`Converter o item ${item.text} em card filho`}
                    onClick={() => convert(item)}
                  >
                    <CIcon icon={cilSitemap} aria-hidden="true" />
                  </CButton>
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
                </span>
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

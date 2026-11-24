import { CFormCheck } from '@coreui/react';
import { useId } from 'react';

import type { BoardCard, BoardLabel } from '../model/board';
import type { BoardCommands } from '../use-board';
import { NewLabelForm } from './new-label-form';

/** Etiquetas do card: marcar e desmarcar as do catálogo, ou criar uma nova já marcada. */
export function LabelsField({
  card,
  labels,
  commands,
}: Readonly<{
  card: BoardCard;
  labels: readonly BoardLabel[];
  commands: Pick<BoardCommands, 'toggleLabel' | 'createLabel'>;
}>) {
  const id = useId();
  return (
    <fieldset>
      <legend className="fs-6 fw-semibold">Etiquetas</legend>
      {labels.length > 0 ? (
        <div className="d-flex flex-wrap gap-3 mb-2">
          {labels.map((label) => (
            <CFormCheck
              key={label.id}
              id={`${id}-${label.id}`}
              label={
                <span className={`badge text-bg-${label.color}`}>
                  {label.name}
                </span>
              }
              checked={card.labelIds?.includes(label.id) ?? false}
              onChange={() =>
                commands.toggleLabel({ cardId: card.id, labelId: label.id })
              }
            />
          ))}
        </div>
      ) : null}
      <NewLabelForm
        onCreate={(label) =>
          commands.createLabel({ ...label, cardId: card.id }) !== undefined
        }
      />
    </fieldset>
  );
}

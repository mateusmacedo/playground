import { CFormSelect } from '@coreui/react';
import { useId } from 'react';

import type { BoardCommands } from '../board-commands';
import type { BoardCard, BoardPerson } from '../model/board';

export interface AssigneeFieldProps {
  readonly card: BoardCard;
  /** Pessoas do quadro, que podem ser responsáveis. */
  readonly people: readonly BoardPerson[];
  readonly commands: Pick<BoardCommands, 'setAssignee'>;
}

/** Responsável pelo card, escolhido entre as pessoas do quadro. */
export function AssigneeField({
  card,
  people,
  commands,
}: Readonly<AssigneeFieldProps>) {
  const id = useId();
  const help =
    people.length === 0
      ? 'Cadastre as pessoas do quadro em "Configurar quadro".'
      : undefined;

  return (
    <CFormSelect
      id={id}
      label="Responsável"
      value={card.assigneeId ?? ''}
      text={help}
      onChange={(event) =>
        commands.setAssignee({
          cardId: card.id,
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
  );
}

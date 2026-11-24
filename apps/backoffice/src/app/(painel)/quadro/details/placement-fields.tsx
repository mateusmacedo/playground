import { CFormSelect } from '@coreui/react';
import { useId } from 'react';

import type { BoardCommands } from '../board-commands';
import { type BoardLane, type CardLocation, findCard } from '../model/board';
import { parentCandidates } from '../model/hierarchy';

export interface PlacementFieldsProps {
  readonly location: CardLocation;
  readonly lanes: readonly BoardLane[];
  readonly commands: Pick<BoardCommands, 'moveCardToLane' | 'setParent'>;
}

/** Onde o card fica no quadro: a coluna e o card pai. */
export function PlacementFields({
  location,
  lanes,
  commands,
}: Readonly<PlacementFieldsProps>) {
  const laneFieldId = useId();
  const parentFieldId = useId();
  const { card, lane } = location;
  const cardId = card.id;
  const candidates = parentCandidates({ lanes, cardId });

  function laneTitleOf(candidateId: string): string | undefined {
    return findCard({ lanes, cardId: candidateId })?.lane.title;
  }

  return (
    <>
      <CFormSelect
        id={laneFieldId}
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
        id={parentFieldId}
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
            {candidate.title} ({laneTitleOf(candidate.id)})
          </option>
        ))}
      </CFormSelect>
    </>
  );
}

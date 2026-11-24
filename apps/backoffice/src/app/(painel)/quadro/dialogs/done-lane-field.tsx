import { CFormSelect } from '@coreui/react';
import { useId } from 'react';

import type { BoardLane } from '../model/board';

export interface DoneLaneFieldProps {
  readonly lanes: readonly BoardLane[];
  /** Coluna escolhida; vazio quando nenhuma. */
  readonly doneLaneId: string;
  readonly onChange: (laneId: string) => void;
}

/** Coluna que conta como concluída no progresso dos filhos de um card. */
export function DoneLaneField({
  lanes,
  doneLaneId,
  onChange,
}: Readonly<DoneLaneFieldProps>) {
  const id = useId();
  // NOTE: a coluna escolhida pode ter sido excluída do quadro; nesse caso o campo volta a "Nenhuma".
  const laneExists = lanes.some((lane) => lane.id === doneLaneId);

  return (
    <CFormSelect
      id={id}
      label="Coluna de conclusão"
      text="O card pai mostra quantos filhos já estão nesta coluna."
      value={laneExists ? doneLaneId : ''}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Nenhuma</option>
      {lanes.map((lane) => (
        <option key={lane.id} value={lane.id}>
          {lane.title}
        </option>
      ))}
    </CFormSelect>
  );
}

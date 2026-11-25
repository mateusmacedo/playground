import { cilArrowLeft, cilArrowRight, cilPlus } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormInput } from '@coreui/react';
import { useId } from 'react';

import { type Lane, laneKey } from '../model/document';
import type { LaneCommands } from './panel-commands';

export interface LanesEditorProps {
  readonly lanes: readonly Lane[];
  readonly commands: LaneCommands;
}

interface LaneProblemParams {
  readonly lanes: readonly Lane[];
  readonly index: number;
}

/** Nome vazio ou já usado por uma raia anterior deixa o papel responsável ambíguo. */
function laneProblem({ lanes, index }: LaneProblemParams): string | null {
  const key = laneKey(lanes[index]?.name ?? '');
  if (key === '') {
    return 'Dê um nome à raia.';
  }
  const earlier = lanes
    .slice(0, index)
    .some((lane) => laneKey(lane.name) === key);
  return earlier ? 'Já existe uma raia com este nome.' : null;
}

/** Raias por papel responsável: criar, renomear e mudar a ordem; o canvas as mostra como colunas, nessa ordem. */
export function LanesEditor({ lanes, commands }: Readonly<LanesEditorProps>) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mt-3">
      <h2 id={headingId} className="h6">
        Raias
      </h2>
      {lanes.length === 0 ? (
        <p className="small text-body-secondary">
          Sem raias. Crie uma por papel responsável.
        </p>
      ) : null}
      <ul className="list-unstyled d-grid gap-2 mb-2">
        {lanes.map((lane, index) => (
          <li key={lane.id} className="d-flex gap-1">
            <CFormInput
              size="sm"
              aria-label={`Nome da raia ${index + 1}`}
              invalid={laneProblem({ lanes, index }) !== null}
              feedbackInvalid={laneProblem({ lanes, index }) ?? undefined}
              value={lane.name}
              onChange={(event) =>
                commands.renameLane({
                  laneId: lane.id,
                  name: event.target.value,
                })
              }
            />
            <CButton
              color="secondary"
              variant="ghost"
              size="sm"
              disabled={index === 0}
              aria-label={`Mover ${lane.name} para a esquerda`}
              onClick={() =>
                commands.moveLane({ laneId: lane.id, direction: 'before' })
              }
            >
              <CIcon icon={cilArrowLeft} aria-hidden="true" />
            </CButton>
            <CButton
              color="secondary"
              variant="ghost"
              size="sm"
              disabled={index === lanes.length - 1}
              aria-label={`Mover ${lane.name} para a direita`}
              onClick={() =>
                commands.moveLane({ laneId: lane.id, direction: 'after' })
              }
            >
              <CIcon icon={cilArrowRight} aria-hidden="true" />
            </CButton>
          </li>
        ))}
      </ul>
      <CButton
        color="secondary"
        variant="outline"
        size="sm"
        onClick={commands.addLane}
      >
        <CIcon icon={cilPlus} aria-hidden="true" className="me-1" />
        Adicionar raia
      </CButton>
    </section>
  );
}

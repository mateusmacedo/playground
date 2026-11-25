import { ViewportPortal } from '@xyflow/react';

import { type Lane, laneBands } from './model/document';

/** Altura das colunas das raias no canvas; elas vão muito além do processo para não acabarem no meio dele. */
const LANE_DEPTH = 8000;

export interface LanesLayerProps {
  readonly lanes: readonly Lane[];
}

/** As raias como colunas no fundo do canvas, com o nome do papel no topo; acompanham o zoom e a navegação. */
export function LanesLayer({ lanes }: Readonly<LanesLayerProps>) {
  if (lanes.length === 0) {
    return null;
  }
  return (
    <ViewportPortal>
      <div className="process-lanes" aria-hidden="true">
        {laneBands(lanes).map(({ lane, left }) => (
          <div
            key={lane.id}
            className="process-lane"
            style={{ left, width: lane.width, height: LANE_DEPTH }}
          >
            <span className="process-lane__name">{lane.name}</span>
          </div>
        ))}
      </div>
    </ViewportPortal>
  );
}

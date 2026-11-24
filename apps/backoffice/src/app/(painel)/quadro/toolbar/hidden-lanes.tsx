import { cilLowVision } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import {
  CDropdown,
  CDropdownDivider,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react';

import type { BoardLane } from '../model/board';

export interface HiddenLanesProps {
  readonly lanes: readonly BoardLane[];
  /** A coluna automática dos arquivados está oculta. */
  readonly archiveHidden: boolean;
  readonly onShow: (laneId: string) => void;
  readonly onShowArchive: () => void;
  readonly onShowAll: () => void;
}

/** Colunas fora da tela, para mostrar de novo uma a uma ou todas; some quando não há coluna oculta. */
export function HiddenLanes({
  lanes,
  archiveHidden,
  onShow,
  onShowArchive,
  onShowAll,
}: Readonly<HiddenLanesProps>) {
  const count = lanes.length + (archiveHidden ? 1 : 0);
  if (count === 0) {
    return null;
  }
  return (
    <CDropdown>
      <CDropdownToggle
        color="secondary"
        variant="outline"
        size="sm"
        data-board-hidden-lanes=""
      >
        <CIcon icon={cilLowVision} aria-hidden="true" className="me-1" />
        Colunas ocultas ({count})
      </CDropdownToggle>
      <CDropdownMenu>
        {lanes.map((lane) => (
          <CDropdownItem
            key={lane.id}
            as="button"
            type="button"
            onClick={() => onShow(lane.id)}
          >
            Mostrar {lane.title}
          </CDropdownItem>
        ))}
        {archiveHidden ? (
          <CDropdownItem as="button" type="button" onClick={onShowArchive}>
            Mostrar Arquivados
          </CDropdownItem>
        ) : null}
        {count > 1 ? (
          <>
            <CDropdownDivider />
            <CDropdownItem as="button" type="button" onClick={onShowAll}>
              Mostrar todas
            </CDropdownItem>
          </>
        ) : null}
      </CDropdownMenu>
    </CDropdown>
  );
}

import { cilOptions } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import {
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react';

import type { BoardLane } from './model/board';

export interface LaneMenuProps {
  readonly lane: BoardLane;
  /** A última coluna do quadro não pode ser excluída. */
  readonly canRemove: boolean;
  /** A última coluna visível não pode ser ocultada. */
  readonly canHide: boolean;
  readonly onRename: () => void;
  readonly onRequestLimit: () => void;
  readonly onToggleCollapse: () => void;
  readonly onHide: () => void;
  readonly onToggleLock: () => void;
  readonly onRequestRemove: () => void;
}

/** Menu de ações da coluna: renomear, limitar, recolher, ocultar, bloquear e excluir. */
export function LaneMenu({
  lane,
  canRemove,
  canHide,
  onRename,
  onRequestLimit,
  onToggleCollapse,
  onHide,
  onToggleLock,
  onRequestRemove,
}: Readonly<LaneMenuProps>) {
  // NOTE: a coluna bloqueada não pode ser excluída, porque excluir tiraria os cards dela.
  const removeDisabled = !canRemove || Boolean(lane.locked);

  return (
    <CDropdown placement="bottom-end">
      <CDropdownToggle
        color="secondary"
        variant="ghost"
        size="sm"
        caret={false}
        aria-label={`Ações da coluna ${lane.title}`}
      >
        <CIcon icon={cilOptions} aria-hidden="true" />
      </CDropdownToggle>
      <CDropdownMenu>
        <CDropdownItem as="button" type="button" onClick={onRename}>
          Renomear
        </CDropdownItem>
        <CDropdownItem as="button" type="button" onClick={onRequestLimit}>
          Limite de cards
        </CDropdownItem>
        <CDropdownItem as="button" type="button" onClick={onToggleCollapse}>
          Recolher coluna
        </CDropdownItem>
        <CDropdownItem
          as="button"
          type="button"
          disabled={!canHide}
          onClick={onHide}
        >
          Ocultar coluna
        </CDropdownItem>
        <CDropdownItem as="button" type="button" onClick={onToggleLock}>
          {lane.locked ? 'Liberar coluna' : 'Bloquear coluna'}
        </CDropdownItem>
        <CDropdownItem
          as="button"
          type="button"
          disabled={removeDisabled}
          onClick={onRequestRemove}
        >
          Excluir coluna
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  );
}

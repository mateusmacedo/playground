import { cilClone, cilTrash } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton } from '@coreui/react';

import type { PanelCommands } from './panel-commands';

export interface SelectionActionsProps {
  readonly commands: PanelCommands;
  readonly canDuplicate: boolean;
}

/** Duplicar e excluir o que está selecionado; conexão sozinha não se duplica. */
export function SelectionActions({
  commands,
  canDuplicate,
}: Readonly<SelectionActionsProps>) {
  return (
    <div className="d-flex flex-wrap gap-2">
      {canDuplicate ? (
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          onClick={commands.duplicateSelected}
        >
          <CIcon icon={cilClone} aria-hidden="true" className="me-1" />
          Duplicar
        </CButton>
      ) : null}
      <CButton
        color="danger"
        variant="outline"
        size="sm"
        onClick={commands.deleteSelected}
      >
        <CIcon icon={cilTrash} aria-hidden="true" className="me-1" />
        Excluir
      </CButton>
    </div>
  );
}

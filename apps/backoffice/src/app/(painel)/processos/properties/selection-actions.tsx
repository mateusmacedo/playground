import { cilClone, cilTrash } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton } from '@coreui/react';
import { useId } from 'react';

import type { PanelCommands } from './panel-commands';

/**
 * Como "Duplicar" aparece: `available` com bloco na seleção; `unavailable` (desabilitado, com o motivo escrito) na
 * seleção múltipla só de conexões; `absent` nas propriedades de uma conexão sozinha, que só se exclui.
 */
export type Duplication = 'available' | 'unavailable' | 'absent';

export interface SelectionActionsProps {
  readonly commands: PanelCommands;
  readonly duplication: Duplication;
}

/** Duplicar e excluir o que está selecionado; conexão não se duplica sem um bloco junto. */
export function SelectionActions({
  commands,
  duplication,
}: Readonly<SelectionActionsProps>) {
  const reasonId = useId();
  const unavailable = duplication === 'unavailable';
  return (
    <>
      <div className="d-flex flex-wrap gap-2">
        {duplication === 'absent' ? null : (
          <CButton
            color="secondary"
            variant="outline"
            size="sm"
            disabled={unavailable}
            aria-describedby={unavailable ? reasonId : undefined}
            onClick={commands.duplicateSelected}
          >
            <CIcon icon={cilClone} aria-hidden="true" className="me-1" />
            Duplicar
          </CButton>
        )}
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
      {unavailable ? (
        <p id={reasonId} className="small text-body-secondary mt-2 mb-0">
          Para duplicar, a seleção precisa ter ao menos um bloco.
        </p>
      ) : null}
    </>
  );
}

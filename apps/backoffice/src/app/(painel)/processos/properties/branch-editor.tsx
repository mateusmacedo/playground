import { cilPlus, cilTrash } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormInput } from '@coreui/react';

import type { ProcessNode } from '../process-graph';
import type { PanelCommands } from './panel-commands';

/** Ramos da Decisão: renomear, remover (com a conexão que sai dele) e criar. */
export function BranchEditor({
  node,
  commands,
}: Readonly<{ node: ProcessNode; commands: PanelCommands }>) {
  const branches = node.data.branches ?? [];
  return (
    <fieldset className="mb-3">
      <legend className="fs-6 fw-semibold">Ramos</legend>
      <ul className="list-unstyled d-grid gap-2 mb-2">
        {branches.map((branch, index) => (
          <li key={branch.id} className="d-flex gap-2">
            <CFormInput
              size="sm"
              aria-label={`Nome do ramo ${index + 1}`}
              value={branch.label}
              onChange={(event) =>
                commands.renameBranch({
                  nodeId: node.id,
                  branchId: branch.id,
                  label: event.target.value,
                })
              }
            />
            <CButton
              color="danger"
              variant="ghost"
              size="sm"
              aria-label={`Remover o ramo ${branch.label}`}
              onClick={() =>
                commands.removeBranch({ nodeId: node.id, branchId: branch.id })
              }
            >
              <CIcon icon={cilTrash} aria-hidden="true" />
            </CButton>
          </li>
        ))}
      </ul>
      <CButton
        color="secondary"
        variant="outline"
        size="sm"
        onClick={() => commands.addBranch(node.id)}
      >
        <CIcon icon={cilPlus} aria-hidden="true" className="me-1" />
        Adicionar ramo
      </CButton>
    </fieldset>
  );
}

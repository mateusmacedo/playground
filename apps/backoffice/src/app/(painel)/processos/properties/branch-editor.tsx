import { cilPlus, cilTrash } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormInput, CFormSelect } from '@coreui/react';
import { useId } from 'react';

import { type Branch, kindOf } from '../model/blocks';
import type { ProcessNode } from '../process-graph';
import type { PanelCommands } from './panel-commands';

export interface BranchEditorProps {
  readonly node: ProcessNode;
  readonly commands: PanelCommands;
}

interface BranchRowProps {
  readonly node: ProcessNode;
  readonly branch: Branch;
  readonly position: number;
  readonly hasCondition: boolean;
  /** Outro ramo da mesma decisão já usa este nome. */
  readonly repeated: boolean;
  readonly commands: PanelCommands;
}

function nameProblem(
  params: Readonly<Pick<BranchRowProps, 'branch' | 'repeated'>>,
): string | null {
  if (params.branch.label.trim() === '') {
    return 'Dê um nome ao ramo.';
  }
  return params.repeated ? 'Já existe um ramo com este nome.' : null;
}

function BranchRow({
  node,
  branch,
  position,
  hasCondition,
  repeated,
  commands,
}: Readonly<BranchRowProps>) {
  const isDefault = branch.id === node.data.defaultBranchId;
  const problem = nameProblem({ branch, repeated });
  return (
    <li className="process-branch-row">
      <div className="d-flex gap-2">
        <CFormInput
          size="sm"
          aria-label={`Nome do ramo ${position}`}
          invalid={problem !== null}
          feedbackInvalid={problem ?? undefined}
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
      </div>
      {hasCondition && isDefault ? (
        <p className="small text-body-secondary mt-1 mb-0">
          Caminho padrão: segue quando nenhuma condição é atendida, por isso não
          tem condição.
        </p>
      ) : null}
      {hasCondition && !isDefault ? (
        <CFormInput
          size="sm"
          className="mt-1"
          aria-label={`Condição do ramo ${branch.label}`}
          placeholder="Condição, por exemplo: valor acima do limite"
          value={branch.condition ?? ''}
          onChange={(event) =>
            commands.updateBranch({
              nodeId: node.id,
              branchId: branch.id,
              patch: { condition: event.target.value },
            })
          }
        />
      ) : null}
      <CFormInput
        size="sm"
        className="mt-1"
        aria-label={`Descrição do ramo ${branch.label}`}
        placeholder="Descrição"
        value={branch.description ?? ''}
        onChange={(event) =>
          commands.updateBranch({
            nodeId: node.id,
            branchId: branch.id,
            patch: { description: event.target.value },
          })
        }
      />
    </li>
  );
}

/** Ids dos ramos cujo nome já apareceu antes na mesma decisão, sem diferença de maiúsculas e espaços. */
function repeatedBranchIds(branches: readonly Branch[]): Set<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const branch of branches) {
    const key = branch.label.trim().toLocaleLowerCase('pt-BR');
    if (key !== '' && seen.has(key)) {
      repeated.add(branch.id);
    }
    seen.add(key);
  }
  return repeated;
}

/** Ramos de uma decisão ou abertura: nome, condição, descrição, caminho padrão, criar e remover. */
export function BranchEditor({ node, commands }: Readonly<BranchEditorProps>) {
  const branches = node.data.branches ?? [];
  const hasCondition = kindOf(node) !== 'parallel-split';
  const defaultId = useId();
  const repeatedNames = repeatedBranchIds(branches);
  return (
    <fieldset className="mb-3">
      <legend className="fs-6 fw-semibold">Ramos</legend>
      <ul className="list-unstyled d-grid gap-3 mb-2">
        {branches.map((branch, index) => (
          <BranchRow
            key={branch.id}
            node={node}
            branch={branch}
            position={index + 1}
            hasCondition={hasCondition}
            repeated={repeatedNames.has(branch.id)}
            commands={commands}
          />
        ))}
      </ul>
      <CButton
        color="secondary"
        variant="outline"
        size="sm"
        className="mb-2"
        onClick={() => commands.addBranch(node.id)}
      >
        <CIcon icon={cilPlus} aria-hidden="true" className="me-1" />
        Adicionar ramo
      </CButton>
      {hasCondition ? (
        <CFormSelect
          id={defaultId}
          size="sm"
          label="Caminho padrão"
          value={node.data.defaultBranchId ?? ''}
          onChange={(event) =>
            commands.setDefaultBranch({
              nodeId: node.id,
              branchId: event.target.value || undefined,
            })
          }
        >
          <option value="">Nenhum</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.label}
            </option>
          ))}
        </CFormSelect>
      ) : null}
    </fieldset>
  );
}

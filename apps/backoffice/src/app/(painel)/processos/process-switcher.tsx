import { cilPlus } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import {
  CButton,
  CDropdown,
  CDropdownDivider,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CFormSelect,
} from '@coreui/react';
import { useId } from 'react';

import type { ProcessDefinition } from '@/shared/process/catalog';

import { processStatus } from './process-status';

/** Janelas que o seletor abre. */
export type CatalogDialogKind =
  | 'new'
  | 'rename'
  | 'describe'
  | 'archive'
  | 'archived';

export interface ProcessSwitcherProps {
  /** Processos não arquivados, na ordem do catálogo. */
  readonly live: readonly ProcessDefinition[];
  readonly active: ProcessDefinition | undefined;
  readonly archivedCount: number;
  readonly onSelect: (definitionId: string) => void;
  readonly onDuplicate: () => void;
  readonly onOpenDialog: (kind: CatalogDialogKind) => void;
}

const STATUS_BADGE = {
  draft: 'text-bg-secondary',
  published: 'text-bg-success',
  changed: 'text-bg-warning',
} as const;

interface ProcessMenuProps
  extends Pick<
    ProcessSwitcherProps,
    'archivedCount' | 'onDuplicate' | 'onOpenDialog'
  > {
  readonly processName: string;
  /** O último processo ativo não pode ser arquivado: o editor precisa de um processo aberto. */
  readonly canArchive: boolean;
}

function ProcessMenu({
  processName,
  canArchive,
  archivedCount,
  onDuplicate,
  onOpenDialog,
}: Readonly<ProcessMenuProps>) {
  return (
    <CDropdown placement="bottom-end">
      <CDropdownToggle
        color="secondary"
        variant="outline"
        size="sm"
        aria-label={`Ações do processo ${processName}`}
      >
        Ações do processo
      </CDropdownToggle>
      <CDropdownMenu>
        <CDropdownItem
          as="button"
          type="button"
          onClick={() => onOpenDialog('rename')}
        >
          Renomear processo
        </CDropdownItem>
        <CDropdownItem
          as="button"
          type="button"
          onClick={() => onOpenDialog('describe')}
        >
          Editar descrição
        </CDropdownItem>
        <CDropdownItem as="button" type="button" onClick={onDuplicate}>
          Duplicar processo
        </CDropdownItem>
        <CDropdownItem
          as="button"
          type="button"
          disabled={!canArchive}
          title={
            canArchive
              ? undefined
              : 'O único processo ativo não pode ser arquivado.'
          }
          onClick={() => onOpenDialog('archive')}
        >
          Arquivar processo
        </CDropdownItem>
        <CDropdownDivider />
        <CDropdownItem
          as="button"
          type="button"
          onClick={() => onOpenDialog('archived')}
        >
          {`Arquivados (${archivedCount})`}
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  );
}

/**
 * Escolha do processo aberto no editor, a situação dele no catálogo e as ações do catálogo: criar, renomear, editar a
 * descrição, duplicar, arquivar e restaurar os arquivados.
 */
export function ProcessSwitcher({
  live,
  active,
  archivedCount,
  onSelect,
  onDuplicate,
  onOpenDialog,
}: Readonly<ProcessSwitcherProps>) {
  const selectId = useId();
  const status = active === undefined ? undefined : processStatus(active);
  return (
    <div className="d-flex flex-wrap align-items-end gap-2 mb-2">
      <div>
        <CFormSelect
          id={selectId}
          label="Processo"
          size="sm"
          value={active?.id ?? ''}
          onChange={(event) => onSelect(event.target.value)}
        >
          {active === undefined ? (
            <option value="">Nenhum processo aberto</option>
          ) : null}
          {live.map((definition) => (
            <option key={definition.id} value={definition.id}>
              {definition.name}
            </option>
          ))}
        </CFormSelect>
      </div>
      {status === undefined ? null : (
        <span className={`badge mb-1 ${STATUS_BADGE[status.kind]}`}>
          {status.label}
        </span>
      )}
      <CButton
        type="button"
        color="primary"
        variant="outline"
        size="sm"
        onClick={() => onOpenDialog('new')}
      >
        <CIcon icon={cilPlus} aria-hidden="true" className="me-1" />
        Novo processo
      </CButton>
      {active === undefined ? (
        <CButton
          type="button"
          color="secondary"
          variant="outline"
          size="sm"
          onClick={() => onOpenDialog('archived')}
        >
          {`Arquivados (${archivedCount})`}
        </CButton>
      ) : (
        <ProcessMenu
          processName={active.name}
          canArchive={live.length > 1}
          archivedCount={archivedCount}
          onDuplicate={onDuplicate}
          onOpenDialog={onOpenDialog}
        />
      )}
      {active?.description ? (
        <p className="small text-body-secondary mb-0 w-100">
          {active.description}
        </p>
      ) : null}
    </div>
  );
}

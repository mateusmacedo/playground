import { cilTags } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import {
  CButton,
  CDropdown,
  CDropdownDivider,
  CDropdownMenu,
  CDropdownToggle,
  CFormCheck,
} from '@coreui/react';
import { useId } from 'react';

import type { BoardLabel } from '../model/board';

export interface LabelFilterProps {
  readonly labels: readonly BoardLabel[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (labelId: string) => void;
  readonly onClear: () => void;
  readonly onManage: () => void;
}

/** Filtro por etiqueta: mostra os cards com qualquer uma das marcadas. Também leva ao catálogo de etiquetas. */
export function LabelFilter({
  labels,
  selected,
  onToggle,
  onClear,
  onManage,
}: Readonly<LabelFilterProps>) {
  const id = useId();
  return (
    <CDropdown autoClose="outside">
      <CDropdownToggle
        color="secondary"
        variant="outline"
        size="sm"
        data-board-labels=""
      >
        <CIcon icon={cilTags} aria-hidden="true" className="me-1" />
        Etiquetas
        {selected.size > 0 ? (
          <span className="badge text-bg-primary ms-1">
            {selected.size}
            <span className="visually-hidden"> no filtro</span>
          </span>
        ) : null}
      </CDropdownToggle>
      <CDropdownMenu className="p-2 kanban-label-filter">
        {labels.length > 0 ? (
          <fieldset>
            <legend className="small text-body-secondary mb-1">
              Mostrar cards com
            </legend>
            {labels.map((label) => (
              <CFormCheck
                key={label.id}
                id={`${id}-${label.id}`}
                label={
                  <span className={`badge text-bg-${label.color}`}>
                    {label.name}
                  </span>
                }
                checked={selected.has(label.id)}
                onChange={() => onToggle(label.id)}
              />
            ))}
          </fieldset>
        ) : (
          <p className="small text-body-secondary mb-0">
            Nenhuma etiqueta no quadro.
          </p>
        )}
        <CDropdownDivider />
        <div className="d-grid gap-1">
          <CButton
            type="button"
            color="secondary"
            variant="ghost"
            size="sm"
            disabled={selected.size === 0}
            onClick={onClear}
          >
            Limpar filtro
          </CButton>
          <CButton
            type="button"
            color="secondary"
            variant="ghost"
            size="sm"
            onClick={onManage}
          >
            Gerenciar etiquetas
          </CButton>
        </div>
      </CDropdownMenu>
    </CDropdown>
  );
}

import { CFormSelect } from '@coreui/react';

import {
  HIERARCHY_FILTERS,
  type HierarchyFilter,
} from '../model/hierarchy-views';

export interface HierarchySelectProps {
  readonly value: HierarchyFilter;
  readonly onChange: (value: HierarchyFilter) => void;
}

/** Filtro de hierarquia: todos os cards, só os pais, só os filhos ou só os de topo. Soma-se à busca e às etiquetas. */
export function HierarchySelect({
  value,
  onChange,
}: Readonly<HierarchySelectProps>) {
  return (
    <CFormSelect
      size="sm"
      className="w-auto"
      aria-label="Filtrar por hierarquia"
      value={value}
      onChange={(event) => {
        const chosen = HIERARCHY_FILTERS.find(
          (option) => option.value === event.target.value,
        );
        if (chosen) {
          onChange(chosen.value);
        }
      }}
    >
      {HIERARCHY_FILTERS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </CFormSelect>
  );
}

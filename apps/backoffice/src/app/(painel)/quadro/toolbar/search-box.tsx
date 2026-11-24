import { cilSearch } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CFormInput, CInputGroup, CInputGroupText } from '@coreui/react';
import type { Ref } from 'react';

export interface SearchBoxProps {
  readonly inputRef: Ref<HTMLInputElement>;
  readonly query: string;
  readonly matchCount: number | null;
  readonly totalCount: number;
  readonly onChange: (query: string) => void;
}

/** Busca de cards; `matchCount` nulo quando não há busca nem filtro ativos. */
export function SearchBox({
  inputRef,
  query,
  matchCount,
  totalCount,
  onChange,
}: Readonly<SearchBoxProps>) {
  return (
    <div className="kanban-search d-flex align-items-center gap-2">
      <CInputGroup size="sm">
        <CInputGroupText>
          <CIcon icon={cilSearch} aria-hidden="true" />
        </CInputGroupText>
        <CFormInput
          ref={inputRef}
          type="search"
          aria-label="Buscar cards"
          placeholder="Buscar cards (/)"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query) {
              event.preventDefault();
              onChange('');
            }
          }}
        />
      </CInputGroup>
      <span
        className="small text-body-secondary text-nowrap"
        aria-live="polite"
      >
        {matchCount === null ? '' : `${matchCount} de ${totalCount} cards`}
      </span>
    </div>
  );
}

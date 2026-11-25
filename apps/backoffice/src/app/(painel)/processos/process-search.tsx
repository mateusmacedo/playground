import { cilSearch } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CFormInput, CInputGroup, CInputGroupText } from '@coreui/react';
import { useId, useState } from 'react';

import { searchProcess } from './model/search';
import type { ProcessGraph } from './process-graph';

export interface ProcessSearchProps {
  readonly graph: ProcessGraph;
  readonly onSelect: (nodeId: string) => void;
}

/** Busca por nome do bloco, nome do ramo ou responsável; escolher um resultado enquadra o bloco e abre o painel. */
export function ProcessSearch({
  graph,
  onSelect,
}: Readonly<ProcessSearchProps>) {
  const [query, setQuery] = useState('');
  const resultsId = useId();
  const results = searchProcess({ graph, query });
  const hasQuery = query.trim() !== '';

  return (
    <search aria-label="Busca no processo" className="mb-3">
      <CInputGroup size="sm">
        <CInputGroupText>
          <CIcon icon={cilSearch} aria-hidden="true" />
        </CInputGroupText>
        <CFormInput
          type="search"
          aria-label="Buscar no processo"
          aria-controls={resultsId}
          placeholder="Bloco, ramo ou responsável"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </CInputGroup>
      <div id={resultsId} aria-live="polite">
        {hasQuery && results.length === 0 ? (
          <p className="small text-body-secondary mt-1 mb-0">
            Nada encontrado.
          </p>
        ) : null}
        {results.length > 0 ? (
          <ul
            className="list-unstyled small mt-1 mb-0 d-grid gap-1"
            aria-label="Resultados da busca"
          >
            {results.map((result) => (
              <li key={result.nodeId}>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-start"
                  onClick={() => onSelect(result.nodeId)}
                >
                  {result.name}
                  <span className="text-body-secondary">
                    {' '}
                    · {result.detail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </search>
  );
}

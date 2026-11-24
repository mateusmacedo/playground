import { cilInbox, cilReload, cilSettings } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton } from '@coreui/react';
import type { Ref } from 'react';

import type { BoardLabel } from '../model/board';
import { HiddenLanes, type HiddenLanesProps } from './hidden-lanes';
import { HistoryButtons } from './history-buttons';
import { LabelFilter } from './label-filter';
import { SearchBox } from './search-box';

export interface BoardToolbarProps {
  readonly instructionsId: string;
  readonly search: {
    readonly inputRef: Ref<HTMLInputElement>;
    readonly query: string;
    readonly matchCount: number | null;
    readonly totalCount: number;
    readonly onChange: (query: string) => void;
  };
  readonly filter: {
    readonly labels: readonly BoardLabel[];
    readonly selected: ReadonlySet<string>;
    readonly onToggle: (labelId: string) => void;
    readonly onClear: () => void;
    readonly onManage: () => void;
  };
  readonly history: {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly onUndo: () => void;
    readonly onRedo: () => void;
  };
  readonly hiddenLanes: HiddenLanesProps;
  readonly archivedCount: number;
  readonly onOpenArchive: () => void;
  /** Sem ela, o quadro não tem configuração na tela. */
  readonly onOpenSettings?: () => void;
  /** Sem ela, o quadro não tem conteúdo de exemplo para restaurar. */
  readonly onReset?: () => void;
}

/** Barra do quadro: busca e filtro à esquerda, histórico e ações gerais à direita, e as instruções de uso. */
export function BoardToolbar({
  instructionsId,
  search,
  filter,
  history,
  hiddenLanes,
  archivedCount,
  onOpenArchive,
  onOpenSettings,
  onReset,
}: Readonly<BoardToolbarProps>) {
  return (
    <div className="mb-2">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <SearchBox {...search} />
        <LabelFilter {...filter} />
        <div className="d-flex flex-wrap gap-2 ms-auto">
          <HistoryButtons {...history} />
          <HiddenLanes {...hiddenLanes} />
          <CButton
            type="button"
            color="secondary"
            variant="outline"
            size="sm"
            data-board-archive=""
            onClick={onOpenArchive}
          >
            <CIcon icon={cilInbox} aria-hidden="true" className="me-1" />
            Arquivados ({archivedCount})
          </CButton>
          {onOpenSettings ? (
            <CButton
              type="button"
              color="secondary"
              variant="outline"
              size="sm"
              data-board-settings=""
              onClick={onOpenSettings}
            >
              <CIcon icon={cilSettings} aria-hidden="true" className="me-1" />
              Configurar quadro
            </CButton>
          ) : null}
          {onReset ? (
            <CButton
              type="button"
              color="secondary"
              variant="outline"
              size="sm"
              data-board-reset=""
              onClick={onReset}
            >
              <CIcon icon={cilReload} aria-hidden="true" className="me-1" />
              Restaurar exemplo
            </CButton>
          ) : null}
        </div>
      </div>
      <p id={instructionsId} className="small text-body-secondary mb-0">
        Arraste os cards entre as colunas e as colunas pela alça do cabeçalho.
        Pelo teclado, use as alças: Espaço ou Enter para pegar e soltar, as
        setas para mover e Esc para cancelar. Clique no card para ver os
        detalhes. Atalhos: / busca, Ctrl+Z desfaz e Ctrl+Shift+Z refaz.
      </p>
    </div>
  );
}

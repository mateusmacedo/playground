import { cilInbox, cilReload, cilSettings } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton } from '@coreui/react';

import { HiddenLanes, type HiddenLanesProps } from './hidden-lanes';
import { HistoryButtons, type HistoryButtonsProps } from './history-buttons';
import { LabelFilter, type LabelFilterProps } from './label-filter';
import { SearchBox, type SearchBoxProps } from './search-box';
import { ViewSwitch, type ViewSwitchProps } from './view-switch';

export interface BoardToolbarProps {
  readonly instructionsId: string;
  readonly search: SearchBoxProps;
  readonly filter: LabelFilterProps;
  readonly history: HistoryButtonsProps;
  readonly view: ViewSwitchProps;
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
  view,
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
        <ViewSwitch {...view} />
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

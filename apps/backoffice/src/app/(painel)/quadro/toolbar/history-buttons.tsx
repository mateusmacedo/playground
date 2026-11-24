import { cilActionRedo, cilActionUndo } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CButtonGroup } from '@coreui/react';

export interface HistoryButtonsProps {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
}

/** Desfazer e refazer; os atalhos estão no título de cada botão. */
export function HistoryButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Readonly<HistoryButtonsProps>) {
  return (
    <CButtonGroup size="sm" role="group" aria-label="Histórico de alterações">
      <CButton
        type="button"
        color="secondary"
        variant="outline"
        disabled={!canUndo}
        title="Desfazer (Ctrl+Z)"
        data-board-undo=""
        onClick={onUndo}
      >
        <CIcon icon={cilActionUndo} aria-hidden="true" className="me-1" />
        Desfazer
      </CButton>
      <CButton
        type="button"
        color="secondary"
        variant="outline"
        disabled={!canRedo}
        title="Refazer (Ctrl+Shift+Z)"
        onClick={onRedo}
      >
        <CIcon icon={cilActionRedo} aria-hidden="true" className="me-1" />
        Refazer
      </CButton>
    </CButtonGroup>
  );
}

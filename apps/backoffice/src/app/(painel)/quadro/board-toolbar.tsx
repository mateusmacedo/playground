import { cilReload } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton } from '@coreui/react';

/** Instruções de uso do quadro e a ação de voltar ao exemplo. */
export function BoardToolbar({
  instructionsId,
  onReset,
}: Readonly<{ instructionsId: string; onReset: () => void }>) {
  return (
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
      <p id={instructionsId} className="small text-body-secondary mb-0">
        Arraste os cards entre as colunas e as colunas pela alça do cabeçalho.
        Pelo teclado, use as alças: Espaço ou Enter para pegar e soltar, as
        setas para mover e Esc para cancelar. Clique no card para ver os
        detalhes.
      </p>
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
    </div>
  );
}

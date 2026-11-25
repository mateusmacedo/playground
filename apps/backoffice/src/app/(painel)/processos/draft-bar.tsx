import { cilReload, cilSave } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CSpinner } from '@coreui/react';

import type { DraftStatus } from './use-draft';

export interface DraftBarProps {
  readonly status: DraftStatus;
  readonly everSaved: boolean;
  readonly onSave: () => void;
}

function statusText(
  params: Readonly<Pick<DraftBarProps, 'status' | 'everSaved'>>,
) {
  const { status, everSaved } = params;
  switch (status) {
    case 'saving':
      return 'Salvando…';
    case 'failed':
      return 'Falha ao salvar o rascunho. A edição continua aqui.';
    case 'saved':
      return 'Rascunho salvo neste navegador.';
    case 'unsaved':
      return everSaved ? 'Alterações não salvas.' : 'Rascunho ainda não salvo.';
  }
}

/** Estado do rascunho e o salvamento explícito, que aceita processo completo ou incompleto. */
export function DraftBar({
  status,
  everSaved,
  onSave,
}: Readonly<DraftBarProps>) {
  const failed = status === 'failed';
  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
      <span
        role="status"
        className={`small ${failed ? 'text-danger-emphasis' : 'text-body-secondary'}`}
      >
        {statusText({ status, everSaved })}
      </span>
      <CButton
        color={failed ? 'danger' : 'primary'}
        variant={failed ? 'outline' : undefined}
        size="sm"
        className="ms-auto"
        disabled={status === 'saving' || status === 'saved'}
        onClick={onSave}
      >
        {status === 'saving' ? (
          <CSpinner size="sm" aria-hidden="true" className="me-1" />
        ) : (
          <CIcon
            icon={failed ? cilReload : cilSave}
            aria-hidden="true"
            className="me-1"
          />
        )}
        {failed ? 'Tentar novamente' : 'Salvar rascunho'}
      </CButton>
    </div>
  );
}

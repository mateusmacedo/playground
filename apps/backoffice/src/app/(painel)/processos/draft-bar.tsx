import { cilReload, cilSave } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CSpinner } from '@coreui/react';
import type { ReactNode } from 'react';
import type { DraftStatus } from './use-draft';
import { useStoragePlace } from './use-storage-place';

export interface DraftBarProps {
  readonly status: DraftStatus;
  readonly everSaved: boolean;
  readonly onSave: () => void;
  /** Ações depois do salvamento, como a publicação do processo do catálogo. */
  readonly children?: ReactNode;
}

interface StatusTextParams extends Pick<DraftBarProps, 'status' | 'everSaved'> {
  /** Onde o rascunho fica guardado ("neste navegador", "no servidor"). */
  readonly place: string;
}

function statusText(params: Readonly<StatusTextParams>) {
  const { status, everSaved, place } = params;
  switch (status) {
    case 'saving':
      return 'Salvando…';
    case 'failed':
      return 'Falha ao salvar o rascunho. A edição continua aqui.';
    case 'saved':
      return `Rascunho salvo ${place}.`;
    case 'unsaved':
      return everSaved ? 'Alterações não salvas.' : 'Rascunho ainda não salvo.';
  }
}

/** Estado do rascunho e o salvamento explícito, que aceita processo completo ou incompleto. */
export function DraftBar({
  status,
  everSaved,
  onSave,
  children,
}: Readonly<DraftBarProps>) {
  const place = useStoragePlace();
  const failed = status === 'failed';
  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
      <span
        role="status"
        className={`small ${failed ? 'text-danger-emphasis' : 'text-body-secondary'}`}
      >
        {statusText({ status, everSaved, place })}
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
      {children}
    </div>
  );
}

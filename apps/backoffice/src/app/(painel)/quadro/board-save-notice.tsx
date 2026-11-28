import { CAlert, CButton, CSpinner } from '@coreui/react';

import type { SaveStatus } from './store/board-store';
import type { SaveActions } from './use-board-storage';

interface ExitButtonProps {
  readonly label: string;
  /** A saída está em andamento: o botão trava e mostra o spinner. */
  readonly busy: boolean;
  readonly color: 'danger' | 'warning';
  readonly onClick: () => void;
}

function ExitButton({
  label,
  busy,
  color,
  onClick,
}: Readonly<ExitButtonProps>) {
  return (
    <CButton
      type="button"
      color={color}
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={onClick}
    >
      {busy ? <CSpinner aria-hidden="true" className="me-2" size="sm" /> : null}
      {label}
    </CButton>
  );
}

export interface BoardSaveNoticeProps {
  readonly save: SaveStatus;
  /** Presentes quando o quadro é gravado num servidor; sem elas, a falha é a falta de espaço no navegador. */
  readonly actions?: SaveActions;
}

/**
 * Aviso da gravação que não deu certo, acima do quadro: a falha, com a nova tentativa, e o conflito com a versão do
 * servidor, com as duas saídas. A edição continua valendo na tela enquanto o aviso está aberto.
 */
export function BoardSaveNotice({
  save,
  actions,
}: Readonly<BoardSaveNoticeProps>) {
  if (save.kind === 'failed' && !actions) {
    return (
      <CAlert color="danger" className="py-2">
        {save.message}
      </CAlert>
    );
  }
  if (save.kind === 'failed' && actions) {
    return (
      <CAlert color="danger" className="py-2">
        <p className="mb-2">
          As últimas mudanças ainda não foram gravadas no servidor e só valem
          enquanto esta página estiver aberta. {save.message}
        </p>
        <ExitButton
          label="Tentar de novo"
          busy={save.busy}
          color="danger"
          onClick={actions.retry}
        />
      </CAlert>
    );
  }
  if (save.kind === 'conflict' && actions) {
    return (
      <CAlert color="warning" className="py-2">
        <p className="mb-2">
          Este quadro foi alterado em outro lugar depois que você o abriu, e as
          suas últimas mudanças ainda não foram gravadas. Recarregar do servidor
          descarta o que você mudou nesta página; manter a sua versão grava o
          quadro desta página por cima do outro.
        </p>
        {save.failure ? (
          <p className="mb-2">Não deu certo: {save.failure}</p>
        ) : null}
        <div className="d-flex flex-wrap gap-2">
          <ExitButton
            label="Recarregar do servidor"
            busy={save.busy}
            color="warning"
            onClick={actions.takeTheirs}
          />
          <ExitButton
            label="Manter a minha versão"
            busy={save.busy}
            color="warning"
            onClick={actions.keepMine}
          />
        </div>
      </CAlert>
    );
  }
  return null;
}

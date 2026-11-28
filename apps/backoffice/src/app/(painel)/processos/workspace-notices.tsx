import { CAlert, CButton } from '@coreui/react';
import { useState } from 'react';
import type { ProcessWorkspace } from './use-process-workspace';
import { useStoragePlace } from './use-storage-place';

export interface WorkspaceNoticesProps {
  readonly workspace: ProcessWorkspace;
}

interface ConflictNoticeProps {
  readonly message: string;
  /** Uma leitura ou uma escolha anterior está em andamento; as escolhas esperam ela terminar. */
  readonly busy: boolean;
  readonly onReload: () => void;
  readonly onKeepMine: () => void;
}

/** O processo foi alterado em outro lugar: a edição continua na tela, e a pessoa escolhe o que vale. */
function ConflictNotice({
  message,
  busy,
  onReload,
  onKeepMine,
}: Readonly<ConflictNoticeProps>) {
  return (
    <CAlert color="warning" className="py-2 small">
      <p className="mb-2">
        {`${message} A sua edição continua nesta tela. Recarregar traz o que está gravado e descarta o que você não salvou; manter grava a sua versão por cima.`}
      </p>
      <div className="d-flex flex-wrap gap-2">
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          type="button"
          disabled={busy}
          onClick={onReload}
        >
          Recarregar do servidor
        </CButton>
        <CButton
          color="primary"
          size="sm"
          type="button"
          disabled={busy}
          onClick={onKeepMine}
        >
          Manter a minha versão
        </CButton>
      </div>
    </CAlert>
  );
}

/** Avisos da página de processos: o do endereço, o do rascunho antigo e os da leitura e da gravação do catálogo. */
export function WorkspaceNotices({
  workspace,
}: Readonly<WorkspaceNoticesProps>) {
  const place = useStoragePlace();
  const { access } = workspace;
  /** Uma escolha desta área está em andamento: recarregar, manter ou gravar de novo. */
  const [resolving, setResolving] = useState(false);
  const busy = access.loading || resolving;

  async function resolve(action: () => Promise<unknown>) {
    setResolving(true);
    await action();
    setResolving(false);
  }

  return (
    <>
      {workspace.notice === null ? null : (
        <CAlert
          color="warning"
          dismissible
          onClose={workspace.dismissNotice}
          className="py-2 small"
        >
          {workspace.notice}
        </CAlert>
      )}
      {workspace.legacyUnreadable ? (
        <CAlert color="warning" dismissible className="py-2 small">
          O rascunho salvo não pôde ser lido; o exemplo foi aberto no lugar.
        </CAlert>
      ) : null}
      {access.loadFailure === null ? null : (
        <CAlert color="danger" className="py-2 small">
          {`Os processos não puderam ser recarregados. ${access.loadFailure.message}`}
        </CAlert>
      )}
      {access.conflict === null ? null : (
        <ConflictNotice
          message={access.conflict.message}
          busy={busy}
          onReload={() => {
            void resolve(workspace.reloadFromServer);
          }}
          onKeepMine={() => {
            void resolve(workspace.keepMine);
          }}
        />
      )}
      {access.storageFailed ? (
        <CAlert color="danger" className="py-2 small">
          <p className="mb-2">
            {`O catálogo de processos não pôde ser gravado ${place}. As mudanças ficam só nesta tela até a próxima gravação dar certo.`}
          </p>
          <CButton
            color="danger"
            variant="outline"
            size="sm"
            type="button"
            disabled={busy}
            onClick={() => {
              void resolve(access.retrySave);
            }}
          >
            Tentar de novo
          </CButton>
        </CAlert>
      ) : null}
    </>
  );
}

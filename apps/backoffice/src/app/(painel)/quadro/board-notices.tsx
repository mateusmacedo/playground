import { CAlert } from '@coreui/react';

/** Aviso visível acima do quadro: link copiado, card do endereço que não pode ser aberto, coluna bloqueada. */
export interface Notice {
  readonly color: 'success' | 'warning';
  readonly text: string;
}

export type Notify = (notice: Notice) => void;

/** Texto lido pelo leitor de tela a cada mudança do quadro. */
export type Announce = (text: string) => void;

export interface BoardNoticesProps {
  /** A última gravação falhou, quase sempre por falta de espaço no navegador. */
  readonly storageFull: boolean;
  readonly notice: Notice | null;
  readonly onDismiss: () => void;
}

/** Avisos acima do quadro: a falta de espaço para gravar e o aviso da última ação. */
export function BoardNotices({
  storageFull,
  notice,
  onDismiss,
}: Readonly<BoardNoticesProps>) {
  return (
    <>
      {storageFull ? (
        <CAlert color="danger" className="py-2">
          O navegador não tem mais espaço para gravar este quadro: as últimas
          mudanças só valem até fechar a página. Remova anexos grandes ou
          arquivados para liberar espaço.
        </CAlert>
      ) : null}
      {notice ? (
        <CAlert
          color={notice.color}
          dismissible
          className="py-2"
          onClose={onDismiss}
        >
          {notice.text}
        </CAlert>
      ) : null}
    </>
  );
}

import { ConfirmModal } from '@/shared/ui/confirm-modal';

import { OnClosed } from '../dialogs/on-closed';

export interface ProcessCancelDialogProps {
  readonly visible: boolean;
  readonly processName: string;
  readonly onConfirm: () => void;
  /** A pessoa desistiu de cancelar. */
  readonly onDismiss: () => void;
  /** A janela terminou de fechar. */
  readonly onClosed: () => void;
}

/** Confirmação de "Cancelar processo": o cancelamento encerra a execução com as etapas pendentes sem resolver. */
export function ProcessCancelDialog({
  visible,
  processName,
  onConfirm,
  onDismiss,
  onClosed,
}: Readonly<ProcessCancelDialogProps>) {
  return (
    <ConfirmModal
      visible={visible}
      title={`Cancelar o processo ${processName}`}
      confirmLabel="Cancelar processo"
      cancelLabel="Manter o processo"
      confirmColor="danger"
      onConfirm={onConfirm}
      onCancel={onDismiss}
    >
      <p className="mb-0">
        A execução é encerrada como cancelada, e as etapas que esperavam uma
        ação ficam sem ser resolvidas. A trilha da execução e o histórico do
        card continuam no card.
      </p>
      {/* NOTE: o conteúdo da janela também desmonta uma vez ao abrir, quando vai para o portal; só vale o fim do fechamento. */}
      <OnClosed
        onClosed={() => {
          if (!visible) {
            onClosed();
          }
        }}
      />
    </ConfirmModal>
  );
}

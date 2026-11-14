'use client';

import { useId, type ReactNode } from 'react';
import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react';

export interface ConfirmModalProps {
  readonly visible: boolean;
  readonly title: string;
  /** O que a ação faz, em uma ou duas frases. */
  readonly children: ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly confirmColor?: 'primary' | 'danger' | 'warning' | 'success';
  /** Gravação em andamento: trava os botões e o fechamento e mostra o spinner na confirmação. */
  readonly busy?: boolean;
  readonly confirmDisabled?: boolean;
  /** A tela grava e, no fim, passa `visible={false}`. */
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Modal de confirmação do template, com "Cancelar" secundário e a ação principal à direita. */
export function ConfirmModal({
  visible,
  title,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmColor = 'primary',
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: Readonly<ConfirmModalProps>) {
  const titleId = useId();

  return (
    <CModal
      aria-labelledby={titleId}
      backdrop={busy ? 'static' : true}
      keyboard={!busy}
      // WHY: o CoreUI chama `onClose` em todo fechamento, inclusive quando a tela fecha o modal depois de confirmar;
      // só conta como cancelamento quando quem fechou foi o usuário, com o modal ainda aberto para a tela.
      onClose={() => {
        if (visible) {
          onCancel();
        }
      }}
      visible={visible}
    >
      <CModalHeader closeButton={!busy}>
        <CModalTitle id={titleId}>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>{children}</CModalBody>
      <CModalFooter>
        <CButton
          color="secondary"
          disabled={busy}
          onClick={onCancel}
          type="button"
        >
          {cancelLabel}
        </CButton>
        <CButton
          color={confirmColor}
          disabled={busy || confirmDisabled}
          onClick={onConfirm}
          type="button"
        >
          {busy && <CSpinner aria-hidden="true" className="me-2" size="sm" />}
          {confirmLabel}
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

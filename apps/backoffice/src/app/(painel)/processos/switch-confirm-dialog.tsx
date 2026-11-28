import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react';
import { useId, useState } from 'react';

export interface SwitchConfirmDialogProps {
  readonly processName: string;
  readonly onSaveAndSwitch: () => Promise<void>;
  readonly onSwitch: () => void;
  readonly onCancel: () => void;
}

/** Confirmação de troca de processo com alteração não salva: salvar e trocar, trocar sem salvar ou cancelar. */
export function SwitchConfirmDialog({
  processName,
  onSaveAndSwitch,
  onSwitch,
  onCancel,
}: Readonly<SwitchConfirmDialogProps>) {
  const titleId = useId();
  const [saving, setSaving] = useState(false);

  async function saveAndSwitch() {
    if (saving) {
      return;
    }
    setSaving(true);
    await onSaveAndSwitch();
  }

  return (
    <CModal
      visible
      aria-labelledby={titleId}
      backdrop={saving ? 'static' : true}
      keyboard={!saving}
      onClose={() => {
        if (!saving) {
          onCancel();
        }
      }}
    >
      <CModalHeader closeButton={!saving}>
        <CModalTitle id={titleId}>Alterações não salvas</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {`O rascunho de ${processName} tem alterações que ainda não foram salvas. Salve antes de trocar, ou troque e descarte as alterações.`}
      </CModalBody>
      <CModalFooter>
        <CButton
          color="secondary"
          type="button"
          disabled={saving}
          onClick={onCancel}
        >
          Cancelar
        </CButton>
        <CButton
          color="danger"
          variant="outline"
          type="button"
          disabled={saving}
          onClick={onSwitch}
        >
          Trocar sem salvar
        </CButton>
        <CButton
          color="primary"
          type="button"
          disabled={saving}
          onClick={() => {
            void saveAndSwitch();
          }}
        >
          {saving ? (
            <CSpinner aria-hidden="true" className="me-2" size="sm" />
          ) : null}
          Salvar e trocar
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

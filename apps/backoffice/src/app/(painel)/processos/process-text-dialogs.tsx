import { CFormInput, CFormTextarea } from '@coreui/react';
import { type FormEvent, useId, useState } from 'react';

import type { ProcessCatalog } from '@/shared/process/catalog';
import { nameRefusal } from '@/shared/process/catalog-names';
import { ConfirmModal } from '@/shared/ui/confirm-modal';

export interface ProcessNameDialogProps {
  readonly title: string;
  readonly confirmLabel: string;
  readonly initialName: string;
  readonly catalog: ProcessCatalog;
  /** Processo renomeado; o nome atual dele não conta como repetido. */
  readonly definitionId?: string;
  readonly onSave: (name: string) => void;
  readonly onCancel: () => void;
}

/** Nome de um processo novo ou do aberto, conferido enquanto se digita: obrigatório e único no catálogo. */
export function ProcessNameDialog({
  title,
  confirmLabel,
  initialName,
  catalog,
  definitionId,
  onSave,
  onCancel,
}: Readonly<ProcessNameDialogProps>) {
  const inputId = useId();
  const feedbackId = useId();
  const [name, setName] = useState(initialName);
  const [touched, setTouched] = useState(false);
  const refusal = nameRefusal({ catalog, name, definitionId });
  const showRefusal = refusal !== undefined && (touched || name !== '');

  function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (refusal !== undefined) {
      setTouched(true);
      return;
    }
    onSave(name.trim());
  }

  return (
    <ConfirmModal
      visible
      title={title}
      confirmLabel={confirmLabel}
      confirmDisabled={refusal !== undefined}
      onConfirm={() => save()}
      onCancel={onCancel}
    >
      <form onSubmit={save}>
        <CFormInput
          id={inputId}
          label="Nome do processo"
          value={name}
          invalid={showRefusal}
          aria-describedby={showRefusal ? feedbackId : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setTouched(true);
          }}
        />
        {showRefusal ? (
          <div id={feedbackId} className="invalid-feedback d-block">
            {refusal.message}
          </div>
        ) : null}
        {/* NOTE: sem botão de envio, o Enter no campo não enviaria o formulário. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </ConfirmModal>
  );
}

export interface ProcessDescriptionDialogProps {
  readonly initialDescription: string;
  readonly onSave: (description: string) => void;
  readonly onCancel: () => void;
}

/** Descrição do processo aberto: texto livre e opcional. */
export function ProcessDescriptionDialog({
  initialDescription,
  onSave,
  onCancel,
}: Readonly<ProcessDescriptionDialogProps>) {
  const textareaId = useId();
  const [description, setDescription] = useState(initialDescription);
  return (
    <ConfirmModal
      visible
      title="Editar descrição"
      confirmLabel="Salvar descrição"
      onConfirm={() => onSave(description.trim())}
      onCancel={onCancel}
    >
      <CFormTextarea
        id={textareaId}
        label="Descrição do processo"
        rows={3}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
    </ConfirmModal>
  );
}

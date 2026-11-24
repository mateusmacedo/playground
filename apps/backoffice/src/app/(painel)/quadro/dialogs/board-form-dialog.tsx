import { CFormInput } from '@coreui/react';
import { type FormEvent, type ReactNode, useId, useState } from 'react';

import { ConfirmModal } from '@/shared/ui/confirm-modal';

import {
  isValidKeyPrefix,
  normalizeKeyPrefix,
  suggestKeyPrefix,
} from '../model/config';

export interface BoardFormValues {
  readonly name: string;
  readonly keyPrefix: string;
}

/**
 * Nome e prefixo do código de um quadro, para criar um quadro novo ou configurar o aberto. Num quadro novo, o prefixo
 * acompanha o nome até a pessoa mexer nele.
 */
export function BoardFormDialog({
  visible,
  title,
  confirmLabel,
  initial,
  suggestPrefix = false,
  validateName,
  prefixHelp,
  onSave,
  onCancel,
  children,
}: Readonly<{
  visible: boolean;
  title: string;
  confirmLabel: string;
  initial: BoardFormValues;
  /** O prefixo segue o nome enquanto não for editado. */
  suggestPrefix?: boolean;
  /** Devolve o nome que vale, ou `null` quando ele está vazio ou repetido. */
  validateName: (name: string) => string | null;
  /** Texto de apoio do campo do prefixo. */
  prefixHelp?: string;
  onSave: (values: BoardFormValues) => void;
  onCancel: () => void;
  /** Conteúdo extra da janela, depois dos campos. */
  children?: ReactNode;
}>) {
  const nameId = useId();
  const prefixId = useId();
  const [name, setName] = useState(initial.name);
  const [prefix, setPrefix] = useState(initial.keyPrefix);
  const [prefixEdited, setPrefixEdited] = useState(!suggestPrefix);
  const validName = validateName(name);
  const keyPrefix = normalizeKeyPrefix(prefix);
  const prefixValid = isValidKeyPrefix(keyPrefix);
  const nameInvalid = name.trim() !== '' && validName === null;

  function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (validName && prefixValid) {
      onSave({ name: validName, keyPrefix });
    }
  }

  return (
    <ConfirmModal
      visible={visible}
      title={title}
      confirmLabel={confirmLabel}
      confirmDisabled={!validName || !prefixValid}
      onConfirm={() => save()}
      onCancel={onCancel}
    >
      <form onSubmit={save} className="d-grid gap-3">
        <CFormInput
          id={nameId}
          label="Nome do quadro"
          value={name}
          invalid={nameInvalid}
          feedbackInvalid="Já existe um quadro com este nome."
          onChange={(event) => {
            setName(event.target.value);
            if (!prefixEdited) {
              setPrefix(suggestKeyPrefix(event.target.value));
            }
          }}
        />
        <CFormInput
          id={prefixId}
          label="Prefixo do código dos cards"
          value={prefix}
          maxLength={6}
          autoCapitalize="characters"
          invalid={!prefixValid}
          feedbackInvalid="Use de 1 a 6 letras ou números, começando por letra."
          text={
            prefixValid
              ? `${prefixHelp ? `${prefixHelp} ` : ''}Exemplo: ${keyPrefix}-12.`
              : undefined
          }
          onChange={(event) => {
            setPrefix(event.target.value);
            setPrefixEdited(true);
          }}
        />
        {/* NOTE: sem botão de envio, o Enter nos campos não enviaria o formulário. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      {children}
    </ConfirmModal>
  );
}

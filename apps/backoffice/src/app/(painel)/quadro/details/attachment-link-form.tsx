import { CButton, CFormInput } from '@coreui/react';
import { type FormEvent, useId, useState } from 'react';

import { isWebLink } from '../model/attachments';

/** Link a anexar: o endereço e o nome que aparece na lista. */
export interface LinkAttachment {
  readonly name: string;
  readonly url: string;
}

export interface AttachmentLinkFormProps {
  readonly onAdd: (link: LinkAttachment) => void;
}

/** Campos para anexar um link ao card; sem nome, o próprio endereço vira o nome. */
export function AttachmentLinkForm({
  onAdd,
}: Readonly<AttachmentLinkFormProps>) {
  const id = useId();
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const addressValid = isWebLink(address);
  const addressTyped = address.trim() !== '';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addressValid) {
      return;
    }
    const url = address.trim();
    onAdd({ name: name.trim() || url, url });
    setAddress('');
    setName('');
  }

  return (
    <form onSubmit={submit} className="d-flex flex-wrap gap-2 mb-2">
      <CFormInput
        id={`${id}-link`}
        type="url"
        size="sm"
        className="flex-grow-1 w-auto"
        aria-label="Endereço do link"
        placeholder="https://"
        value={address}
        invalid={addressTyped && !addressValid}
        onChange={(event) => setAddress(event.target.value)}
      />
      <CFormInput
        id={`${id}-name`}
        size="sm"
        className="w-auto"
        aria-label="Nome do link (opcional)"
        placeholder="Nome (opcional)"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <CButton
        type="submit"
        color="secondary"
        variant="outline"
        size="sm"
        disabled={!addressValid}
      >
        Anexar link
      </CButton>
    </form>
  );
}

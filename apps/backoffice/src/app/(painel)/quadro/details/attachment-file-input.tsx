import { CFormInput } from '@coreui/react';
import { type ChangeEvent, useId, useState } from 'react';

import { formatBytes, MAX_ATTACHMENT_BYTES } from '../model/attachments';

/** Arquivo a anexar, já lido como `data:` URL. */
export interface FileAttachment {
  readonly name: string;
  readonly url: string;
  /** Tamanho do arquivo, em bytes. */
  readonly size: number;
}

export interface AttachmentFileInputProps {
  readonly onAdd: (file: FileAttachment) => void;
}

/** Lê o arquivo como `data:` URL. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Campo para anexar um arquivo pequeno ao card; o arquivo acima do limite é recusado com a explicação. */
export function AttachmentFileInput({
  onAdd,
}: Readonly<AttachmentFileInputProps>) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const limit = formatBytes(MAX_ATTACHMENT_BYTES);

  async function attach(file: File) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(
        `O arquivo ${file.name} tem ${formatBytes(file.size)}; o limite é ${limit}. Anexe um link para ele.`,
      );
      return;
    }
    try {
      const url = await readAsDataUrl(file);
      setError(null);
      onAdd({ name: file.name, url, size: file.size });
    } catch {
      setError(`Não foi possível ler o arquivo ${file.name}.`);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // NOTE: limpar o campo deixa a pessoa escolher o mesmo arquivo de novo depois de um erro.
    input.value = '';
    if (file) {
      void attach(file);
    }
  }

  return (
    <>
      <CFormInput
        id={id}
        type="file"
        size="sm"
        label="Anexar arquivo"
        text={`Até ${limit}; o arquivo fica guardado no navegador, junto com o quadro.`}
        onChange={onChange}
      />
      {error ? (
        <p className="small text-danger mt-1 mb-0" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

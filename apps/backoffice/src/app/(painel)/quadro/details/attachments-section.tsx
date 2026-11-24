import { cilFile, cilLink } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormInput } from '@coreui/react';
import { type ChangeEvent, type FormEvent, useId, useState } from 'react';
import type { BoardCommands } from '../board-commands';
import {
  formatBytes,
  isStoredFile,
  isWebLink,
  MAX_ATTACHMENT_BYTES,
} from '../model/attachments';
import type { BoardCard } from '../model/board';

/** Lê o arquivo como `data:` URL. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export interface AttachmentsSectionProps {
  readonly card: BoardCard;
  readonly commands: Pick<BoardCommands, 'addAttachment' | 'removeAttachment'>;
}

/** Anexos do card: links e arquivos pequenos, com abrir, baixar e remover. */
export function AttachmentsSection({
  card,
  commands,
}: Readonly<AttachmentsSectionProps>) {
  const headingId = useId();
  const id = useId();
  const [link, setLink] = useState('');
  const [linkName, setLinkName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const attachments = card.attachments ?? [];
  const linkValid = isWebLink(link);

  function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!linkValid) {
      return;
    }
    const url = link.trim();
    commands.addAttachment({
      cardId: card.id,
      attachment: { name: linkName.trim() || url, url },
    });
    setLink('');
    setLinkName('');
  }

  async function addFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(
        `O arquivo ${file.name} tem ${formatBytes(file.size)}; o limite é ${formatBytes(MAX_ATTACHMENT_BYTES)}. Anexe um link para ele.`,
      );
      return;
    }
    try {
      const url = await readAsDataUrl(file);
      setError(null);
      commands.addAttachment({
        cardId: card.id,
        attachment: { name: file.name, url, size: file.size },
      });
    } catch {
      setError(`Não foi possível ler o arquivo ${file.name}.`);
    }
  }

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="h6">
        Anexos ({attachments.length})
      </h3>
      {attachments.length > 0 ? (
        <ul className="list-unstyled d-grid gap-1 mb-2">
          {attachments.map((attachment) => {
            const file = isStoredFile(attachment);
            return (
              <li
                key={attachment.id}
                className="d-flex align-items-center gap-2"
              >
                <CIcon icon={file ? cilFile : cilLink} aria-hidden="true" />
                <a
                  href={attachment.url}
                  className="text-truncate"
                  target="_blank"
                  rel="noopener noreferrer"
                  download={file ? attachment.name : undefined}
                >
                  {attachment.name}
                </a>
                {attachment.size === undefined ? null : (
                  <span className="small text-body-secondary text-nowrap">
                    {formatBytes(attachment.size)}
                  </span>
                )}
                <CButton
                  type="button"
                  color="danger"
                  variant="ghost"
                  size="sm"
                  className="ms-auto py-0"
                  aria-label={`Remover o anexo ${attachment.name}`}
                  onClick={() =>
                    commands.removeAttachment({
                      cardId: card.id,
                      attachmentId: attachment.id,
                    })
                  }
                >
                  Remover
                </CButton>
              </li>
            );
          })}
        </ul>
      ) : null}
      <form onSubmit={addLink} className="d-flex flex-wrap gap-2 mb-2">
        <CFormInput
          id={`${id}-link`}
          type="url"
          size="sm"
          className="flex-grow-1 w-auto"
          aria-label="Endereço do link"
          placeholder="https://"
          value={link}
          invalid={link.trim() !== '' && !linkValid}
          onChange={(event) => setLink(event.target.value)}
        />
        <CFormInput
          id={`${id}-name`}
          size="sm"
          className="w-auto"
          aria-label="Nome do link (opcional)"
          placeholder="Nome (opcional)"
          value={linkName}
          onChange={(event) => setLinkName(event.target.value)}
        />
        <CButton
          type="submit"
          color="secondary"
          variant="outline"
          size="sm"
          disabled={!linkValid}
        >
          Anexar link
        </CButton>
      </form>
      <CFormInput
        id={`${id}-file`}
        type="file"
        size="sm"
        label="Anexar arquivo"
        text={`Até ${formatBytes(MAX_ATTACHMENT_BYTES)}; o arquivo fica guardado no navegador, junto com o quadro.`}
        onChange={(event) => {
          void addFile(event);
        }}
      />
      {error ? (
        <p className="small text-danger mt-1 mb-0" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

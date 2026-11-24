import { cilFile, cilLink } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton } from '@coreui/react';

import { formatBytes, isStoredFile } from '../model/attachments';
import type { CardAttachment } from '../model/board';

export interface AttachmentListProps {
  readonly attachments: readonly CardAttachment[];
  readonly onRemove: (attachmentId: string) => void;
}

/** Anexos do card: o link abre em outra aba, e o arquivo guardado é baixado com o nome original. */
export function AttachmentList({
  attachments,
  onRemove,
}: Readonly<AttachmentListProps>) {
  if (attachments.length === 0) {
    return null;
  }
  return (
    <ul className="list-unstyled d-grid gap-1 mb-2">
      {attachments.map((attachment) => {
        const isFile = isStoredFile(attachment);
        return (
          <li key={attachment.id} className="d-flex align-items-center gap-2">
            <CIcon icon={isFile ? cilFile : cilLink} aria-hidden="true" />
            <a
              href={attachment.url}
              className="text-truncate"
              target="_blank"
              rel="noopener noreferrer"
              download={isFile ? attachment.name : undefined}
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
              onClick={() => onRemove(attachment.id)}
            >
              Remover
            </CButton>
          </li>
        );
      })}
    </ul>
  );
}

import { useId } from 'react';

import type { BoardCommands } from '../board-commands';
import type { BoardCard } from '../model/board';
import { AttachmentFileInput } from './attachment-file-input';
import { AttachmentLinkForm } from './attachment-link-form';
import { AttachmentList } from './attachment-list';

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
  const attachments = card.attachments ?? [];
  const cardId = card.id;

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="h6">
        Anexos ({attachments.length})
      </h3>
      <AttachmentList
        attachments={attachments}
        onRemove={(attachmentId) =>
          commands.removeAttachment({ cardId, attachmentId })
        }
      />
      <AttachmentLinkForm
        onAdd={(link) => commands.addAttachment({ cardId, attachment: link })}
      />
      <AttachmentFileInput
        onAdd={(file) => commands.addAttachment({ cardId, attachment: file })}
      />
    </section>
  );
}

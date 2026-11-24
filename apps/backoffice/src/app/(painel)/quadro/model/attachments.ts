import {
  type BoardCard,
  type BoardLane,
  type CardAttachment,
  updateCardIn,
} from './board';
import { nextId } from './ids';

/**
 * Tamanho máximo de um arquivo anexado. WHY: o quadro fica no armazenamento do navegador, que guarda poucos megabytes
 * por site; arquivo maior que isso ocuparia o espaço de todos os quadros.
 */
export const MAX_ATTACHMENT_BYTES = 500 * 1024;

/** Link aceito como anexo: endereço `http` ou `https` completo. */
export function isWebLink(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** O anexo é um arquivo guardado no quadro, e não um link. */
export function isStoredFile(attachment: CardAttachment): boolean {
  return attachment.url.startsWith('data:');
}

const sizeFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return bytes < 1024 * 1024
    ? `${sizeFormat.format(bytes / 1024)} KB`
    : `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}

/** Acrescenta o anexo no fim; nome vazio, link inválido ou arquivo acima do limite não mudam nada. */
export function addAttachment(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly attachment: Omit<CardAttachment, 'id'>;
}): readonly BoardLane[] {
  const name = params.attachment.name.trim();
  const { url, size } = params.attachment;
  const file = url.startsWith('data:');
  if (
    !name ||
    (file
      ? (size ?? Number.POSITIVE_INFINITY) > MAX_ATTACHMENT_BYTES
      : !isWebLink(url))
  ) {
    return params.lanes;
  }
  return updateCardIn({
    lanes: params.lanes,
    cardId: params.cardId,
    update: (card): BoardCard => {
      const attachments = card.attachments ?? [];
      const id = nextId({
        prefix: 'attachment',
        taken: attachments.map((item) => item.id),
      });
      return {
        ...card,
        attachments: [
          ...attachments,
          { ...params.attachment, id, name, url: file ? url : url.trim() },
        ],
      };
    },
  });
}

export function removeAttachment(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly attachmentId: string;
}): readonly BoardLane[] {
  return updateCardIn({
    lanes: params.lanes,
    cardId: params.cardId,
    update: (card) => {
      const attachments = (card.attachments ?? []).filter(
        (item) => item.id !== params.attachmentId,
      );
      if (attachments.length === (card.attachments ?? []).length) {
        return card;
      }
      return {
        ...card,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
    },
  });
}

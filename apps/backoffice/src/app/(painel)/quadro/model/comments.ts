import {
  type BoardCard,
  type BoardLane,
  type CardComment,
  updateCardIn,
} from './board';
import { nextId } from './ids';

/** Tamanho máximo do texto de um comentário. */
export const MAX_COMMENT_LENGTH = 2000;

/** Acrescenta o comentário no fim; texto vazio não muda nada, e o longo demais é cortado. */
export function addComment(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly comment: Omit<CardComment, 'id'>;
}): readonly BoardLane[] {
  const text = params.comment.text.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!text) {
    return params.lanes;
  }
  return updateCardIn({
    lanes: params.lanes,
    cardId: params.cardId,
    update: (card): BoardCard => {
      const comments = card.comments ?? [];
      const id = nextId({
        prefix: 'comment',
        taken: comments.map((item) => item.id),
      });
      return {
        ...card,
        comments: [...comments, { ...params.comment, id, text }],
      };
    },
  });
}

export function removeComment(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly commentId: string;
}): readonly BoardLane[] {
  return updateCardIn({
    lanes: params.lanes,
    cardId: params.cardId,
    update: (card) => {
      const comments = (card.comments ?? []).filter(
        (item) => item.id !== params.commentId,
      );
      if (comments.length === (card.comments ?? []).length) {
        return card;
      }
      return {
        ...card,
        comments: comments.length > 0 ? comments : undefined,
      };
    },
  });
}

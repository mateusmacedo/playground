import { CButton, CFormTextarea } from '@coreui/react';
import { type FormEvent, useId, useState } from 'react';

import type { BoardCard } from '../model/board';
import { MAX_COMMENT_LENGTH } from '../model/comments';
import type { BoardCommands } from '../use-board';

const moment = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/** Comentários do card, do mais antigo para o mais recente, e o campo para comentar. */
export function CommentsSection({
  card,
  author,
  commands,
}: Readonly<{
  card: BoardCard;
  /** Nome de quem comenta. */
  author: string;
  commands: Pick<BoardCommands, 'addComment' | 'removeComment'>;
}>) {
  const headingId = useId();
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const comments = card.comments ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim()) {
      commands.addComment({ cardId: card.id, author, text: draft });
      setDraft('');
    }
  }

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="h6">
        Comentários ({comments.length})
      </h3>
      {comments.length > 0 ? (
        <ul className="list-unstyled d-grid gap-2 mb-2">
          {comments.map((comment) => (
            <li key={comment.id} className="border rounded p-2">
              <div className="d-flex align-items-baseline gap-2">
                <strong className="small">{comment.author}</strong>
                <span className="small text-body-secondary">
                  {moment.format(new Date(comment.at))}
                </span>
                <CButton
                  type="button"
                  color="danger"
                  variant="ghost"
                  size="sm"
                  className="ms-auto py-0"
                  aria-label={`Excluir o comentário de ${comment.author}`}
                  onClick={() =>
                    commands.removeComment({
                      cardId: card.id,
                      commentId: comment.id,
                    })
                  }
                >
                  Excluir
                </CButton>
              </div>
              <p className="mb-0 kanban-comment__text">{comment.text}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <form onSubmit={submit} className="d-grid gap-2">
        <CFormTextarea
          id={inputId}
          aria-label="Novo comentário"
          placeholder="Escreva um comentário"
          rows={2}
          maxLength={MAX_COMMENT_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // NOTE: Ctrl+Enter envia, como nos campos de comentário mais comuns; Enter sozinho quebra a linha.
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div>
          <CButton
            type="submit"
            color="primary"
            size="sm"
            disabled={!draft.trim()}
          >
            Comentar
          </CButton>
        </div>
      </form>
    </section>
  );
}

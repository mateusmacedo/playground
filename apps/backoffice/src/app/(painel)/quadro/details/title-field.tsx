import { CFormInput } from '@coreui/react';
import { useId, useState } from 'react';

import type { BoardCommands } from '../board-commands';

export interface TitleFieldProps {
  readonly cardId: string;
  readonly title: string;
  readonly commands: Pick<BoardCommands, 'updateCard'>;
}

/** Título do card com rascunho: o vazio não chega ao quadro, e uma mudança de fora (o desfazer) substitui o rascunho. */
export function TitleField({
  cardId,
  title,
  commands,
}: Readonly<TitleFieldProps>) {
  const id = useId();
  const [draft, setDraft] = useState(title);
  const [seen, setSeen] = useState(title);
  if (seen !== title) {
    setSeen(title);
    if (draft.trim() !== title) {
      setDraft(title);
    }
  }

  return (
    <CFormInput
      id={id}
      label="Título"
      value={draft}
      invalid={!draft.trim()}
      feedbackInvalid="O título não pode ficar vazio."
      onChange={(event) => {
        setDraft(event.target.value);
        commands.updateCard({ cardId, patch: { title: event.target.value } });
      }}
      onBlur={() => setDraft(title)}
    />
  );
}

import { useState } from 'react';

import type { EditorDocument } from './editor-document';
import { parseDocument } from './model/draft';
import { compilePlan } from './model/plan-compile';
import {
  documentErrorCount,
  type EditorPublication,
  publishBlocker,
} from './publication';
import type { DraftState } from './use-draft';
import { useStoragePlace } from './use-storage-place';

export type PublishTone = 'success' | 'danger';

/** Resultado da última publicação, para a tela. */
export interface PublishFeedback {
  readonly tone: PublishTone;
  readonly text: string;
}

export interface UsePublishParams {
  readonly document: EditorDocument;
  readonly draft: DraftState;
  readonly publication: EditorPublication;
}

export interface PublishState {
  /** Por que não dá para publicar agora; `null` quando dá. */
  readonly blocker: string | null;
  readonly publishing: boolean;
  readonly feedback: PublishFeedback | null;
  readonly publish: () => Promise<void>;
}

/**
 * Publicação do processo aberto: confere os erros, compila o desenho e grava a versão junto com o rascunho. Depois de
 * publicar, o rascunho conta como salvo, porque a versão grava o mesmo texto. Quando a gravação falha, a versão não
 * entra no processo, e publicar de novo é a nova tentativa.
 */
export function usePublish(params: UsePublishParams): PublishState {
  const { document, draft, publication } = params;
  const place = useStoragePlace();
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState<PublishFeedback | null>(null);
  const blocker = publishBlocker({
    errors: documentErrorCount(document),
    text: draft.text,
    latest: publication.latest,
  });

  async function publish() {
    const reading = parseDocument(draft.text);
    if (publishing || blocker !== null || reading === null) {
      return;
    }
    const snapshot = draft.text;
    setPublishing(true);
    setFeedback(null);
    const outcome = await publication.publish({
      documentText: snapshot,
      plan: compilePlan(reading.document),
    });
    setPublishing(false);
    if (outcome.kind === 'published') {
      draft.markSaved(snapshot);
      setFeedback({
        tone: 'success',
        text: `Versão ${outcome.version} publicada.`,
      });
    } else if (outcome.kind === 'refused') {
      setFeedback({ tone: 'danger', text: outcome.message });
    } else {
      setFeedback({
        tone: 'danger',
        text: `A versão não pôde ser gravada ${place}. A edição continua aqui.`,
      });
    }
  }

  return { blocker, publishing, feedback, publish };
}

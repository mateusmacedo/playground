import { useMemo, useState } from 'react';

import type { DraftStore } from './draft-store';
import type { EditorDocument } from './editor-document';
import { serializeDocument } from './model/draft';

export type DraftStatus = 'unsaved' | 'saving' | 'saved' | 'failed';

export interface UseDraftParams {
  readonly document: EditorDocument;
  readonly store: DraftStore;
  /** O documento aberto veio de um rascunho salvo. */
  readonly restored: boolean;
}

export interface DraftState {
  readonly status: DraftStatus;
  readonly hasChanges: boolean;
  readonly everSaved: boolean;
  /** Texto do documento como está na tela, no formato gravado. */
  readonly text: string;
  /** Grava o rascunho; devolve `true` quando a gravação deu certo. */
  readonly save: () => Promise<boolean>;
  /** Registra que `text` foi gravado por outro caminho (a publicação grava o rascunho junto com a versão). */
  readonly markSaved: (text: string) => void;
}

/**
 * Estado do rascunho: salvo, com alterações pendentes, gravando ou com falha. A comparação é pelo texto salvo, então
 * seleção e medidas da tela não contam como alteração. Depois de uma falha a edição continua intacta e dá para tentar
 * de novo.
 */
export function useDraft({
  document,
  store,
  restored,
}: UseDraftParams): DraftState {
  const text = useMemo(() => serializeDocument(document), [document]);
  const [savedText, setSavedText] = useState<string | null>(() =>
    restored ? text : null,
  );
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasChanges = text !== savedText;

  async function save(): Promise<boolean> {
    if (saving) {
      return false;
    }
    const snapshot = text;
    setSaving(true);
    setFailed(false);
    try {
      await store.save(snapshot);
      setSavedText(snapshot);
      return true;
    } catch {
      // WHY: a falha vira estado na tela, com nova tentativa; o erro do navegador não tem o que dizer ao usuário.
      setFailed(true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function markSaved(published: string) {
    setSavedText(published);
    setFailed(false);
  }

  let status: DraftStatus = hasChanges ? 'unsaved' : 'saved';
  if (saving) {
    status = 'saving';
  } else if (failed) {
    status = 'failed';
  }
  return {
    status,
    hasChanges,
    everSaved: savedText !== null,
    text,
    save,
    markSaved,
  };
}

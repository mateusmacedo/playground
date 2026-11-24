import { type KeyboardEvent, type RefObject, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export interface UseLaneRenameParams {
  /** Nome atual da coluna, que vira o texto inicial da edição. */
  readonly title: string;
  readonly onRename: (title: string) => void;
}

export interface LaneRenameState {
  /** Texto em edição; `null` fora da edição. */
  readonly draft: string | null;
  /** Vai no campo de edição. */
  readonly inputRef: RefObject<HTMLInputElement | null>;
  /** Vai no título, que recebe o foco quando a edição termina pelo teclado. */
  readonly titleRef: RefObject<HTMLHeadingElement | null>;
  readonly start: () => void;
  readonly onChange: (text: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onBlur: () => void;
}

/** Edição do nome da coluna no próprio cabeçalho: Enter ou sair do campo salva, Esc cancela. */
export function useLaneRename(params: UseLaneRenameParams): LaneRenameState {
  const { title, onRename } = params;
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // WHY: o campo sai da tela no Esc; se o navegador disparar o blur nessa saída, ele não pode salvar o rascunho.
  const cancelled = useRef(false);

  function start() {
    cancelled.current = false;
    // WHY: o campo precisa estar na tela antes de receber o foco, então a mudança de estado é aplicada na hora.
    flushSync(() => setDraft(title));
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  function finish(save: boolean) {
    if (draft !== null && save) {
      onRename(draft);
    }
    setDraft(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const isEnter = event.key === 'Enter';
    const isEscape = event.key === 'Escape';
    if (!isEnter && !isEscape) {
      return;
    }
    event.preventDefault();
    cancelled.current = isEscape;
    flushSync(() => finish(isEnter));
    titleRef.current?.focus();
  }

  function onBlur() {
    if (!cancelled.current) {
      finish(true);
    }
  }

  return {
    draft,
    inputRef,
    titleRef,
    start,
    onChange: setDraft,
    onKeyDown,
    onBlur,
  };
}

/** Lê do `localStorage`; com o armazenamento bloqueado pelo navegador, devolve `null`. */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Grava no `localStorage`; cota cheia ou armazenamento bloqueado não interrompem a tela. */
export function writeStorage(params: {
  readonly key: string;
  readonly value: string;
}): void {
  try {
    window.localStorage.setItem(params.key, params.value);
  } catch {
    // NOTE: sem armazenamento, o quadro segue só na memória.
  }
}

/** Apaga a chave do `localStorage`; com o armazenamento bloqueado, não faz nada. */
export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // NOTE: sem armazenamento, não há o que apagar.
  }
}

/**
 * Chama `onChange` quando outra aba grava ou apaga a chave; a própria aba não recebe o evento. Devolve a função que
 * para de ouvir.
 */
export function subscribeStorage(params: {
  readonly key: string;
  readonly onChange: (value: string | null) => void;
}): () => void {
  const listener = (event: StorageEvent) => {
    if (event.key === params.key) {
      params.onChange(event.newValue);
    }
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

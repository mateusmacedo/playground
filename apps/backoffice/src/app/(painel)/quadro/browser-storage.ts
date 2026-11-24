/** Lê do `localStorage`; com o armazenamento bloqueado pelo navegador, devolve `null`. */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export interface WriteStorageParams {
  readonly key: string;
  readonly value: string;
}

/**
 * Grava no `localStorage`; cota cheia ou armazenamento bloqueado não interrompem a tela. Devolve `false` quando não
 * gravou, para quem precisar avisar.
 */
export function writeStorage(params: WriteStorageParams): boolean {
  try {
    window.localStorage.setItem(params.key, params.value);
    return true;
  } catch {
    // NOTE: sem armazenamento, o quadro segue só na memória.
    return false;
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

export interface SubscribeStorageParams {
  readonly key: string;
  readonly onChange: (value: string | null) => void;
}

/**
 * Chama `onChange` quando outra aba grava ou apaga a chave; a própria aba não recebe o evento. Devolve a função que
 * para de ouvir.
 */
export function subscribeStorage(params: SubscribeStorageParams): () => void {
  const listener = (event: StorageEvent) => {
    if (event.key === params.key) {
      params.onChange(event.newValue);
    }
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

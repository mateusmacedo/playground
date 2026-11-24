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

/** Em que ponto está a leitura do que a tela mostra; `message` é o motivo da falha, em uma frase para a tela. */
export type LoadPhase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly message: string };

export const READY: LoadPhase = { kind: 'ready' };
export const LOADING: LoadPhase = { kind: 'loading' };

export function failedPhase(message: string): LoadPhase {
  return { kind: 'failed', message };
}

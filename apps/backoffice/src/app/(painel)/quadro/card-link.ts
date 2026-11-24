import type { Notify } from './board-notices';
import type { BoardCard } from './model/board';
import { cardKey } from './model/card-key';

/** O navegador deixa a página escrever na área de transferência. */
export function canCopyLinks(): boolean {
  return typeof navigator.clipboard?.writeText === 'function';
}

export interface CopyCardLinkParams {
  readonly card: Pick<BoardCard, 'number'>;
  /** Prefixo do código dos cards do quadro. */
  readonly keyPrefix: string;
  readonly notify: Notify;
}

/** Copia o endereço da página com o card aberto (`?card=QD-12`) e avisa se deu certo. */
export function copyCardLink(params: CopyCardLinkParams): void {
  const key = cardKey({ card: params.card, prefix: params.keyPrefix });
  const url = new URL(window.location.href);
  url.searchParams.set('card', key);
  navigator.clipboard.writeText(url.href).then(
    () =>
      params.notify({
        color: 'success',
        text: `Link do card ${key} copiado.`,
      }),
    () =>
      params.notify({
        color: 'warning',
        text: 'O navegador não deixou copiar o link.',
      }),
  );
}

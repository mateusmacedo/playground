import { type BoardLane, findCard } from './board';

export type MoveAnnouncement = 'grabbed' | 'moved' | 'dropped' | 'cancelled';

/**
 * Texto que o leitor de tela anuncia a cada passo do movimento, com a coluna e a posição atuais do card. Card que não
 * está no quadro não gera anúncio.
 */
export function announcementText(params: {
  readonly kind: MoveAnnouncement;
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}): string {
  const location = findCard(params.lanes, params.cardId);
  if (!location) {
    return '';
  }

  const title = location.card.title;
  const position = location.cardIndex + 1;
  const total = location.lane.cards.length;
  const place = `coluna ${location.lane.title}, posição ${position} de ${total}`;
  switch (params.kind) {
    case 'grabbed':
      return `${title} pego: ${place}.`;
    case 'moved':
      return `${title}: ${place}.`;
    case 'dropped':
      return `${title} solto: ${place}.`;
    case 'cancelled':
      return `Movimento cancelado. ${title} voltou para ${place}.`;
  }
}

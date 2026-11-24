import { type BoardLane, findCard } from './board';
import { isOverLimit } from './lanes';

export type MoveAnnouncement = 'grabbed' | 'moved' | 'dropped' | 'cancelled';

/** Aviso de coluna acima do limite depois de um movimento; vazio quando a coluna está dentro dele. */
function limitWarning(lane: BoardLane): string {
  return isOverLimit(lane)
    ? ` Coluna ${lane.title} acima do limite: ${lane.cards.length} cards para ${lane.wipLimit}.`
    : '';
}

export interface AnnouncementTextParams {
  readonly kind: MoveAnnouncement;
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}

/**
 * Texto que o leitor de tela anuncia a cada passo do movimento, com a coluna e a posição atuais do card. Card que não
 * está no quadro não gera anúncio.
 */
export function announcementText(params: AnnouncementTextParams): string {
  const location = findCard({ lanes: params.lanes, cardId: params.cardId });
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
      return `${title}: ${place}.${limitWarning(location.lane)}`;
    case 'dropped':
      return `${title} solto: ${place}.${limitWarning(location.lane)}`;
    case 'cancelled':
      return `Movimento cancelado. ${title} voltou para ${place}.`;
  }
}

export interface LaneAnnouncementTextParams {
  readonly kind: MoveAnnouncement;
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
}

/** O mesmo anúncio para o movimento de uma coluna, com a posição dela no quadro. */
export function laneAnnouncementText(
  params: LaneAnnouncementTextParams,
): string {
  const index = params.lanes.findIndex((lane) => lane.id === params.laneId);
  const lane = params.lanes[index];
  if (!lane) {
    return '';
  }

  const place = `posição ${index + 1} de ${params.lanes.length}`;
  switch (params.kind) {
    case 'grabbed':
      return `Coluna ${lane.title} pega: ${place}.`;
    case 'moved':
      return `Coluna ${lane.title}: ${place}.`;
    case 'dropped':
      return `Coluna ${lane.title} solta: ${place}.`;
    case 'cancelled':
      return `Movimento cancelado. Coluna ${lane.title} voltou para a ${place}.`;
  }
}

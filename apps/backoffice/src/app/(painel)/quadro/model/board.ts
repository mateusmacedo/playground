/** Item do checklist de um card; o id só precisa ser único dentro do card. */
export interface ChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
}

/** Registro do histórico do card, com o que mudou na hora em que mudou (`at`, ISO 8601). */
export type CardActivity =
  | { readonly at: string; readonly kind: 'created'; readonly lane: string }
  | {
      readonly at: string;
      readonly kind: 'moved';
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly at: string;
      readonly kind: 'renamed';
      readonly from: string;
      readonly to: string;
    }
  | { readonly at: string; readonly kind: 'description' }
  | {
      readonly at: string;
      readonly kind: 'parent';
      readonly from?: string;
      readonly to?: string;
    }
  | {
      readonly at: string;
      readonly kind: 'labels';
      readonly added: readonly string[];
      readonly removed: readonly string[];
    }
  | { readonly at: string; readonly kind: 'due'; readonly to?: string }
  | { readonly at: string; readonly kind: 'due-done'; readonly done: boolean }
  | {
      readonly at: string;
      readonly kind: 'checklist';
      readonly done: number;
      readonly total: number;
    }
  | { readonly at: string; readonly kind: 'archived' }
  | { readonly at: string; readonly kind: 'restored'; readonly lane: string }
  | { readonly at: string; readonly kind: 'duplicated'; readonly from: string };

/** Card do quadro sem saber o que representa: identidade, texto e os dados genéricos de qualquer quadro. */
export interface BoardCard {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  /** Card pai na hierarquia; pai e filho podem estar em colunas diferentes. */
  readonly parentId?: string;
  /** Número sequencial no quadro, que forma o código (`QD-12`); só dado de entrada chega sem ele. */
  readonly number?: number;
  readonly labelIds?: readonly string[];
  /** Data do prazo, no formato `AAAA-MM-DD`. */
  readonly dueDate?: string;
  readonly dueDone?: boolean;
  readonly checklist?: readonly ChecklistItem[];
  /** Histórico do card, do mais antigo para o mais recente. */
  readonly activity?: readonly CardActivity[];
}

/** Coluna do quadro; a ordem de `cards` é a ordem na tela. */
export interface BoardLane {
  readonly id: string;
  readonly title: string;
  readonly cards: readonly BoardCard[];
  /** Máximo de cards esperado na coluna (o limite de WIP); passar dele só gera destaque, não bloqueia. */
  readonly wipLimit?: number;
  /** Fora da tela até alguém mostrar de novo; os cards continuam no quadro. */
  readonly hidden?: boolean;
  /** Não recebe nem solta cards, e a ordem deles não muda; editar o conteúdo dos cards continua valendo. */
  readonly locked?: boolean;
}

export type LabelColor =
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'
  | 'primary'
  | 'secondary';

/** Etiqueta do catálogo do quadro; os cards guardam só o id. */
export interface BoardLabel {
  readonly id: string;
  readonly name: string;
  readonly color: LabelColor;
}

/** Card que saiu do quadro arquivado, com a coluna de onde saiu para voltar a ela. */
export interface ArchivedCard {
  readonly card: BoardCard;
  readonly laneId: string;
}

/** Um arquivamento: o card escolhido (o primeiro da lista) e os descendentes, que saem e voltam juntos. */
export interface ArchiveEntry {
  /** Id do card escolhido. */
  readonly id: string;
  readonly archivedAt: string;
  readonly cards: readonly ArchivedCard[];
}

/** Configuração própria de cada quadro. */
export interface BoardConfig {
  /** Prefixo do código dos cards (`QD` em `QD-12`). */
  readonly keyPrefix: string;
  /** A coluna automática dos arquivados está oculta. */
  readonly archiveLaneHidden?: boolean;
}

/** O quadro inteiro: colunas, arquivados, etiquetas, configuração e o próximo número de card, que nunca volta atrás. */
export interface Board {
  readonly lanes: readonly BoardLane[];
  /** Do arquivamento mais recente para o mais antigo. */
  readonly archive: readonly ArchiveEntry[];
  readonly labels: readonly BoardLabel[];
  readonly nextNumber: number;
  readonly config: BoardConfig;
}

export interface CardLocation {
  readonly lane: BoardLane;
  readonly laneIndex: number;
  readonly card: BoardCard;
  readonly cardIndex: number;
}

export type StepDirection = 'up' | 'down' | 'left' | 'right';

export function findCard(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}): CardLocation | undefined {
  const { lanes, cardId } = params;
  for (const [laneIndex, lane] of lanes.entries()) {
    const cardIndex = lane.cards.findIndex((card) => card.id === cardId);
    const card = lane.cards[cardIndex];
    if (card) {
      return { lane, laneIndex, card, cardIndex };
    }
  }
  return undefined;
}

/** Todos os cards do quadro, coluna por coluna, na ordem da tela. */
export function allCards(lanes: readonly BoardLane[]): readonly BoardCard[] {
  return lanes.flatMap((lane) => lane.cards);
}

/** Aplica `update` ao card; card inexistente ou `update` que devolve o mesmo card mantêm o próprio `lanes`. */
export function updateCardIn(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly update: (card: BoardCard) => BoardCard;
}): readonly BoardLane[] {
  const { lanes, cardId, update } = params;
  const location = findCard({ lanes, cardId });
  if (!location) {
    return lanes;
  }
  const next = update(location.card);
  if (next === location.card) {
    return lanes;
  }
  return lanes.map((lane, index) =>
    index === location.laneIndex
      ? {
          ...lane,
          cards: lane.cards.map((card) => (card.id === cardId ? next : card)),
        }
      : lane,
  );
}

/**
 * Devolve o quadro com o card na nova posição, sem alterar o original. Card ou coluna inexistente e movimento para o
 * mesmo lugar devolvem o próprio `lanes`, então repetir um movimento não muda nada.
 */
export function moveCard(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly toLaneId: string;
  /** Posição final na coluna de destino, contada sem o próprio card; fora da faixa, vai para a ponta mais próxima. */
  readonly toIndex: number;
}): readonly BoardLane[] {
  const { lanes, cardId, toLaneId } = params;
  const origin = findCard({ lanes, cardId });
  const destination = lanes.find((lane) => lane.id === toLaneId);
  if (!origin || !destination) {
    return lanes;
  }

  const remaining = destination.cards.filter((card) => card.id !== cardId);
  const toIndex = Math.min(Math.max(params.toIndex, 0), remaining.length);
  const sameLane = origin.lane.id === destination.id;
  if (sameLane && origin.cardIndex === toIndex) {
    return lanes;
  }

  const destinationCards = [
    ...remaining.slice(0, toIndex),
    origin.card,
    ...remaining.slice(toIndex),
  ];
  return lanes.map((lane) => {
    if (lane.id === destination.id) {
      return { ...lane, cards: destinationCards };
    }
    if (lane.id === origin.lane.id) {
      return {
        ...lane,
        cards: lane.cards.filter((card) => card.id !== cardId),
      };
    }
    return lane;
  });
}

/**
 * Converte a fenda onde o card foi solto (antes do card que está na posição `slot` da coluna, como aparece na tela)
 * na posição final do `moveCard`. Na mesma coluna, abaixo da origem, a fenda conta o próprio card e perde uma posição.
 */
export function slotToIndex(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly laneId: string;
  readonly slot: number;
}): number {
  const { lanes, cardId, laneId, slot } = params;
  const origin = findCard({ lanes, cardId });
  if (origin && origin.lane.id === laneId && slot > origin.cardIndex) {
    return slot - 1;
  }
  return slot;
}

/** Um passo do teclado: acima ou abaixo na mesma coluna, ou para a coluna vizinha mantendo a altura possível. */
export function stepCard(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly direction: StepDirection;
}): readonly BoardLane[] {
  const { lanes, cardId, direction } = params;
  const origin = findCard({ lanes, cardId });
  if (!origin) {
    return lanes;
  }

  if (direction === 'up' || direction === 'down') {
    const offset = direction === 'up' ? -1 : 1;
    return moveCard({
      lanes,
      cardId,
      toLaneId: origin.lane.id,
      toIndex: origin.cardIndex + offset,
    });
  }

  const neighborIndex =
    direction === 'left' ? origin.laneIndex - 1 : origin.laneIndex + 1;
  const neighbor = lanes[neighborIndex];
  if (!neighbor) {
    return lanes;
  }
  return moveCard({
    lanes,
    cardId,
    toLaneId: neighbor.id,
    toIndex: origin.cardIndex,
  });
}

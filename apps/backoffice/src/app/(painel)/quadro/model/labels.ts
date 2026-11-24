import {
  type Board,
  type BoardCard,
  type BoardLabel,
  type BoardLane,
  type LabelColor,
  updateCardIn,
} from './board';
import { nextId } from './ids';
import { normalizeText } from './search';

/** As cores que uma etiqueta pode ter, com o nome que aparece na tela. */
export const LABEL_COLORS: readonly {
  readonly color: LabelColor;
  readonly name: string;
}[] = [
  { color: 'danger', name: 'Vermelha' },
  { color: 'warning', name: 'Amarela' },
  { color: 'success', name: 'Verde' },
  { color: 'info', name: 'Azul-clara' },
  { color: 'primary', name: 'Azul' },
  { color: 'secondary', name: 'Cinza' },
];

export function nextLabelId(labels: readonly BoardLabel[]): string {
  return nextId({ prefix: 'label', taken: labels.map((label) => label.id) });
}

/** Outra etiqueta do catálogo já usa o nome, sem contar maiúsculas e acentos. */
function nameTaken(params: {
  readonly labels: readonly BoardLabel[];
  readonly name: string;
  readonly exceptId?: string;
}): boolean {
  const wanted = normalizeText(params.name);
  return params.labels.some(
    (label) =>
      label.id !== params.exceptId && normalizeText(label.name) === wanted,
  );
}

/** Põe a etiqueta no card, ou tira se ele já tem. */
export function toggleCardLabel(params: {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly labelId: string;
}): readonly BoardLane[] {
  const { lanes, cardId, labelId } = params;
  return updateCardIn({
    lanes,
    cardId,
    update: (card) => {
      const current = card.labelIds ?? [];
      const labelIds = current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId];
      return { ...card, labelIds: labelIds.length > 0 ? labelIds : undefined };
    },
  });
}

/** Cria a etiqueta no catálogo e, com `cardId`, já a põe no card. Nome vazio ou repetido não cria nada. */
export function createLabel(params: {
  readonly board: Board;
  readonly label: BoardLabel;
  readonly cardId?: string;
}): Board {
  const { board, label, cardId } = params;
  const name = label.name.trim();
  if (!name || nameTaken({ labels: board.labels, name })) {
    return board;
  }
  const lanes = cardId
    ? toggleCardLabel({ lanes: board.lanes, cardId, labelId: label.id })
    : board.lanes;
  return { ...board, lanes, labels: [...board.labels, { ...label, name }] };
}

/** Renomeia ou troca a cor da etiqueta; nome vazio ou de outra etiqueta mantém o anterior. */
export function updateLabel(params: {
  readonly board: Board;
  readonly labelId: string;
  readonly patch: Partial<Pick<BoardLabel, 'name' | 'color'>>;
}): Board {
  const { board, labelId, patch } = params;
  const label = board.labels.find((candidate) => candidate.id === labelId);
  if (!label) {
    return board;
  }
  const typed = patch.name?.trim();
  const name =
    typed &&
    !nameTaken({ labels: board.labels, name: typed, exceptId: labelId })
      ? typed
      : label.name;
  const color = patch.color ?? label.color;
  if (name === label.name && color === label.color) {
    return board;
  }
  return {
    ...board,
    labels: board.labels.map((candidate) =>
      candidate.id === labelId ? { ...candidate, name, color } : candidate,
    ),
  };
}

function withoutLabel(card: BoardCard, labelId: string): BoardCard {
  if (!card.labelIds?.includes(labelId)) {
    return card;
  }
  const labelIds = card.labelIds.filter((id) => id !== labelId);
  return { ...card, labelIds: labelIds.length > 0 ? labelIds : undefined };
}

/** Exclui a etiqueta do catálogo e de todos os cards, inclusive os arquivados. */
export function removeLabel(params: {
  readonly board: Board;
  readonly labelId: string;
}): Board {
  const { board, labelId } = params;
  if (!board.labels.some((label) => label.id === labelId)) {
    return board;
  }
  return {
    ...board,
    labels: board.labels.filter((label) => label.id !== labelId),
    lanes: board.lanes.map((lane) => ({
      ...lane,
      cards: lane.cards.map((card) => withoutLabel(card, labelId)),
    })),
    archive: board.archive.map((entry) => ({
      ...entry,
      cards: entry.cards.map((archived) => ({
        ...archived,
        card: withoutLabel(archived.card, labelId),
      })),
    })),
  };
}

/** Etiquetas do card, na ordem do catálogo. */
export function cardLabels(params: {
  readonly card: BoardCard;
  readonly labels: readonly BoardLabel[];
}): readonly BoardLabel[] {
  const ids = params.card.labelIds ?? [];
  return params.labels.filter((label) => ids.includes(label.id));
}

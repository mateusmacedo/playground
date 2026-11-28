import { type Board, type BoardCard, findCard } from './board';

/** O que o card filho novo recebe do pai quando a regra `childInherits` está ligada. */
export type InheritedData = Pick<BoardCard, 'assigneeId' | 'labelIds'>;

export interface InheritedFromParentParams {
  readonly board: Board;
  /** Pai do card que vai nascer; sem pai, não há herança. */
  readonly parentId: string | undefined;
}

/**
 * Responsável e etiquetas que o card filho novo herda do pai, só com a regra `childInherits` ligada e o pai nas
 * colunas. Só vem o que o pai tem: sem responsável nem etiqueta, o objeto vem vazio.
 */
export function inheritedFromParent(
  params: InheritedFromParentParams,
): InheritedData {
  const { board, parentId } = params;
  if (!board.config.rules?.childInherits || parentId === undefined) {
    return {};
  }
  const parent = findCard({ lanes: board.lanes, cardId: parentId })?.card;
  if (!parent) {
    return {};
  }
  const inherited: { assigneeId?: string; labelIds?: readonly string[] } = {};
  if (parent.assigneeId !== undefined) {
    inherited.assigneeId = parent.assigneeId;
  }
  if (parent.labelIds && parent.labelIds.length > 0) {
    inherited.labelIds = parent.labelIds;
  }
  return inherited;
}

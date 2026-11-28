import {
  allCards,
  type Board,
  type BoardCard,
  type BoardLane,
  findCard,
} from './board';
import { archivedCards } from './board-state';
import { cardKey } from './card-key';
import { nextId } from './ids';
import { brokenLock } from './lane-state';
import {
  CARD_MISSING,
  type RefusedProcessChange,
  refusedChange,
} from './process-run';

export interface CopiedTree {
  readonly ok: true;
  readonly board: Board;
  /** Id da cópia do card escolhido. */
  readonly copyId: string;
}

export type TreeCopyResult = CopiedTree | RefusedProcessChange;

export interface DuplicateCardTreeParams {
  readonly board: Board;
  readonly cardId: string;
  /** Instante da duplicação, ISO 8601. */
  readonly at: string;
}

interface CopyOfParams {
  readonly board: Board;
  readonly original: BoardCard;
  readonly id: string;
  readonly parentId: string | undefined;
  readonly number: number;
  /** A cópia do card escolhido, a única marcada como cópia no título. */
  readonly root: boolean;
  readonly at: string;
}

/** A cópia de um card da árvore, com os dados dele, mas sem processo, etapa, bloqueadores nem histórico. */
function copyOf(params: CopyOfParams): BoardCard {
  const { board, original, root, at } = params;
  return {
    ...original,
    id: params.id,
    title: root ? `${original.title} (cópia)` : original.title,
    parentId: params.parentId,
    number: params.number,
    process: undefined,
    stepOf: undefined,
    blockedBy: undefined,
    activity: [
      {
        at,
        kind: 'duplicated',
        from: cardKey({ card: original, prefix: board.config.keyPrefix }),
      },
    ],
  };
}

interface LaneCopiesParams {
  readonly lane: BoardLane;
  /** A cópia de cada card da árvore, pelo id do original. */
  readonly copies: ReadonlyMap<string, BoardCard>;
}

/** A coluna com cada cópia logo abaixo do original; sem original nela, a própria coluna. */
function withCopies(params: LaneCopiesParams): BoardLane {
  const { lane, copies } = params;
  if (!lane.cards.some((card) => copies.has(card.id))) {
    return lane;
  }
  const cards: BoardCard[] = [];
  for (const card of lane.cards) {
    cards.push(card);
    const copy = copies.get(card.id);
    if (copy) {
      cards.push(copy);
    }
  }
  return { ...lane, cards };
}

interface TreeOfParams {
  readonly board: Board;
  readonly root: BoardCard;
}

/** O card escolhido e os descendentes, cada um seguido dos próprios filhos, que vêm na ordem da tela. */
function treeOf(params: TreeOfParams): readonly BoardCard[] {
  const { board, root } = params;
  const cards = allCards(board.lanes);
  const tree: BoardCard[] = [];
  const pending: BoardCard[] = [root];
  const seen = new Set([root.id]);
  for (let card = pending.pop(); card; card = pending.pop()) {
    tree.push(card);
    const parentId = card.id;
    const children = cards.filter(
      (candidate) => candidate.parentId === parentId && !seen.has(candidate.id),
    );
    for (const child of children) {
      seen.add(child.id);
    }
    // NOTE: a pilha tira o último primeiro; os filhos entram ao contrário para sair na ordem da tela.
    pending.push(...children.reverse());
  }
  return tree;
}

/**
 * Duplica o card com todas as descendentes: cada cópia fica logo abaixo do original, as cópias formam a mesma
 * hierarquia e a raiz da cópia fica com o pai do original. Só a raiz leva "(cópia)" no título. Execução do processo,
 * etapa que o card executa e bloqueadores ficam só nos originais. Recusa o card que não existe e a coluna bloqueada.
 */
export function duplicateCardTree(
  params: DuplicateCardTreeParams,
): TreeCopyResult {
  const { board, cardId, at } = params;
  const root = findCard({ lanes: board.lanes, cardId })?.card;
  if (!root) {
    return refusedChange(CARD_MISSING);
  }
  const originals = treeOf({ board, root });
  const taken = [...allCards(board.lanes), ...archivedCards(board)].map(
    (card) => card.id,
  );
  const copyIds = new Map<string, string>();
  for (const original of originals) {
    const id = nextId({ prefix: 'card', taken });
    taken.push(id);
    copyIds.set(original.id, id);
  }

  const copies = new Map<string, BoardCard>();
  for (const [index, original] of originals.entries()) {
    const isRoot = original === root;
    const parentId = isRoot
      ? original.parentId
      : copyIds.get(original.parentId ?? '');
    const copy = copyOf({
      board,
      original,
      id: copyIds.get(original.id) ?? original.id,
      parentId,
      number: board.nextNumber + index,
      root: isRoot,
      at,
    });
    copies.set(original.id, copy);
  }

  const lanes = board.lanes.map((lane) => withCopies({ lane, copies }));
  const locked = brokenLock({ before: board.lanes, after: lanes });
  if (locked) {
    return refusedChange(
      `A coluna ${locked.title} está bloqueada: libere a coluna para duplicar o card com os filhos.`,
    );
  }
  return {
    ok: true,
    board: {
      ...board,
      lanes,
      nextNumber: board.nextNumber + originals.length,
    },
    copyId: copyIds.get(root.id) ?? root.id,
  };
}

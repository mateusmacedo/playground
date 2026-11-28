import type { BoardLane } from './board';

/** Quantos filhos do card estão na coluna de conclusão, de quantos ele tem. */
export interface ChildProgress {
  readonly done: number;
  readonly total: number;
  /** A contagem vai além dos filhos diretos (netos em diante); só o progresso agregado marca. */
  readonly nested?: boolean;
}

export interface ChildProgressParams {
  readonly lanes: readonly BoardLane[];
  readonly doneLaneId: string | undefined;
}

/**
 * Progresso dos filhos de cada card pai, contando os filhos diretos que estão na coluna de conclusão do quadro. Sem
 * coluna de conclusão, ou com uma que não existe mais, não há progresso.
 */
export function childProgress(
  params: ChildProgressParams,
): ReadonlyMap<string, ChildProgress> {
  const { lanes, doneLaneId } = params;
  const progress = new Map<string, ChildProgress>();
  if (!doneLaneId || !lanes.some((lane) => lane.id === doneLaneId)) {
    return progress;
  }
  for (const lane of lanes) {
    for (const card of lane.cards) {
      if (card.parentId === undefined) {
        continue;
      }
      const current = progress.get(card.parentId) ?? { done: 0, total: 0 };
      progress.set(card.parentId, {
        done: current.done + (lane.id === doneLaneId ? 1 : 0),
        total: current.total + 1,
      });
    }
  }
  return progress;
}

interface AncestorIdsParams {
  /** Pai de cada card das colunas, pelo id. */
  readonly parents: ReadonlyMap<string, string | undefined>;
  readonly cardId: string;
}

/** Ids dos pais do card, do pai direto até a raiz; para num pai que não está nas colunas e num ciclo. */
function ancestorIds(params: AncestorIdsParams): readonly string[] {
  const { parents, cardId } = params;
  const ids: string[] = [];
  const visited = new Set([cardId]);
  let parentId = parents.get(cardId);
  while (parentId !== undefined && parents.has(parentId)) {
    if (visited.has(parentId)) {
      break;
    }
    ids.push(parentId);
    visited.add(parentId);
    parentId = parents.get(parentId);
  }
  return ids;
}

/**
 * Progresso de todas as descendentes de cada card (filhos, netos e assim por diante), contando as que estão na coluna
 * de conclusão. Sem coluna de conclusão, ou com uma que não existe mais, não há progresso.
 */
export function descendantProgress(
  params: ChildProgressParams,
): ReadonlyMap<string, ChildProgress> {
  const { lanes, doneLaneId } = params;
  const progress = new Map<string, ChildProgress>();
  if (!doneLaneId || !lanes.some((lane) => lane.id === doneLaneId)) {
    return progress;
  }
  const parents = new Map<string, string | undefined>();
  for (const lane of lanes) {
    for (const card of lane.cards) {
      parents.set(card.id, card.parentId);
    }
  }
  for (const lane of lanes) {
    const done = lane.id === doneLaneId ? 1 : 0;
    for (const card of lane.cards) {
      for (const ancestorId of ancestorIds({ parents, cardId: card.id })) {
        const current = progress.get(ancestorId) ?? { done: 0, total: 0 };
        progress.set(ancestorId, {
          done: current.done + done,
          total: current.total + 1,
        });
      }
    }
  }
  return progress;
}

/**
 * Progresso que as telas mostram: todas as descendentes de cada card, com `nested` quando a contagem passa dos filhos
 * diretos, para o texto falar em descendentes. O pai que não está nas colunas fica de fora.
 */
export function aggregateProgress(
  params: ChildProgressParams,
): ReadonlyMap<string, ChildProgress> {
  const direct = childProgress(params);
  const all = descendantProgress(params);
  const progress = new Map<string, ChildProgress>();
  for (const [cardId, children] of direct) {
    const descendants = all.get(cardId);
    if (!descendants) {
      continue;
    }
    const nested = descendants.total > children.total;
    progress.set(cardId, nested ? { ...descendants, nested } : descendants);
  }
  return progress;
}

/** Nome do que o progresso conta, no plural: filhos ou, com netos em diante, descendentes. */
export function progressNoun(progress: ChildProgress): string {
  return progress.nested ? 'descendentes' : 'filhos';
}

/** O progresso em uma frase, para o card e o leitor de tela. */
export function progressText(progress: ChildProgress): string {
  if (progress.nested) {
    return `${progress.done} de ${progress.total} descendentes concluídos`;
  }
  return `${progress.done} de ${progress.total} ${progress.total === 1 ? 'filho concluído' : 'filhos concluídos'}`;
}

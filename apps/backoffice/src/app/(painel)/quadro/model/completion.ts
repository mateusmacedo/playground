import type { BoardLane } from './board';

/** Quantos filhos diretos do card estão na coluna de conclusão, de quantos ele tem. */
export interface ChildProgress {
  readonly done: number;
  readonly total: number;
}

/**
 * Progresso dos filhos de cada card pai, contando os filhos diretos que estão na coluna de conclusão do quadro. Sem
 * coluna de conclusão, ou com uma que não existe mais, não há progresso.
 */
export function childProgress(params: {
  readonly lanes: readonly BoardLane[];
  readonly doneLaneId: string | undefined;
}): ReadonlyMap<string, ChildProgress> {
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

/** O progresso em uma frase, para o card e o leitor de tela. */
export function progressText(progress: ChildProgress): string {
  return `${progress.done} de ${progress.total} ${progress.total === 1 ? 'filho concluído' : 'filhos concluídos'}`;
}

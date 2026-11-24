import { useState } from 'react';

import type { BoardCard, BoardLabel } from './model/board';
import { cardMatchesLabels, cardMatchesQuery } from './model/search';

export interface UseBoardFilterParams {
  readonly labels: readonly BoardLabel[];
  /** Prefixo do código dos cards, para a busca achar o card pelo código. */
  readonly keyPrefix: string;
}

export interface BoardFilter {
  readonly query: string;
  readonly setQuery: (query: string) => void;
  /** Etiquetas escolhidas no filtro que ainda existem no quadro. */
  readonly activeLabels: ReadonlySet<string>;
  readonly toggleLabel: (labelId: string) => void;
  readonly clearLabels: () => void;
  /** Há busca ou filtro de etiqueta em uso. */
  readonly filtering: boolean;
  /** O card passa na busca e no filtro de etiquetas. */
  readonly matches: (card: BoardCard) => boolean;
}

/** Busca por texto e filtro por etiqueta do quadro. */
export function useBoardFilter(params: UseBoardFilterParams): BoardFilter {
  const { labels, keyPrefix } = params;
  const [query, setQuery] = useState('');
  const [chosenLabels, setChosenLabels] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // NOTE: a etiqueta escolhida pode ter sido excluída do quadro; ela sai do filtro sem mexer no que foi escolhido.
  const activeLabels = new Set<string>();
  for (const label of labels) {
    if (chosenLabels.has(label.id)) {
      activeLabels.add(label.id);
    }
  }

  function toggleLabel(labelId: string) {
    setChosenLabels((current) => {
      const next = new Set(current);
      if (next.has(labelId)) {
        next.delete(labelId);
      } else {
        next.add(labelId);
      }
      return next;
    });
  }

  function matches(card: BoardCard): boolean {
    return (
      cardMatchesQuery({ card, query, labels, keyPrefix }) &&
      cardMatchesLabels({ card, labelIds: activeLabels })
    );
  }

  return {
    query,
    setQuery,
    activeLabels,
    toggleLabel,
    clearLabels: () => setChosenLabels(new Set()),
    filtering: query.trim() !== '' || activeLabels.size > 0,
    matches,
  };
}

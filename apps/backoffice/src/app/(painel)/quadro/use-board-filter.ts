import { useState } from 'react';

import type { BoardCard, BoardLabel, BoardLane } from './model/board';
import {
  cardMatchesHierarchy,
  type HierarchyFilter,
  hierarchyIndex,
} from './model/hierarchy-views';
import { cardMatchesLabels, cardMatchesQuery } from './model/search';

export interface UseBoardFilterParams {
  readonly labels: readonly BoardLabel[];
  /** Prefixo do código dos cards, para a busca achar o card pelo código. */
  readonly keyPrefix: string;
  /** Todas as colunas do quadro: o pai ou o filho de um card pode estar numa coluna oculta. */
  readonly lanes: readonly BoardLane[];
}

export interface BoardFilter {
  readonly query: string;
  readonly setQuery: (query: string) => void;
  /** Etiquetas escolhidas no filtro que ainda existem no quadro. */
  readonly activeLabels: ReadonlySet<string>;
  readonly toggleLabel: (labelId: string) => void;
  readonly clearLabels: () => void;
  /** Recorte da hierarquia: todos os cards, só os pais, só os filhos ou só os de topo. */
  readonly hierarchy: HierarchyFilter;
  readonly setHierarchy: (hierarchy: HierarchyFilter) => void;
  /** Há busca, filtro de etiqueta ou filtro de hierarquia em uso. */
  readonly filtering: boolean;
  /** O card passa na busca, no filtro de etiquetas e no de hierarquia. */
  readonly matches: (card: BoardCard) => boolean;
}

/** Busca por texto e filtros do quadro, por etiqueta e por hierarquia, que se somam. */
export function useBoardFilter(params: UseBoardFilterParams): BoardFilter {
  const { labels, keyPrefix, lanes } = params;
  const [query, setQuery] = useState('');
  const [hierarchy, setHierarchy] = useState<HierarchyFilter>('all');
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

  // NOTE: quem é pai e quem é filho é calculado uma vez por desenho, e só com o filtro de hierarquia em uso.
  const index = hierarchy === 'all' ? undefined : hierarchyIndex(lanes);

  function matches(card: BoardCard): boolean {
    return (
      cardMatchesQuery({ card, query, labels, keyPrefix }) &&
      cardMatchesLabels({ card, labelIds: activeLabels }) &&
      (index === undefined ||
        cardMatchesHierarchy({ card, filter: hierarchy, index }))
    );
  }

  return {
    query,
    setQuery,
    activeLabels,
    toggleLabel,
    clearLabels: () => setChosenLabels(new Set()),
    hierarchy,
    setHierarchy,
    filtering:
      query.trim() !== '' || activeLabels.size > 0 || hierarchy !== 'all',
    matches,
  };
}

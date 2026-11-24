import { useState } from 'react';

import type { ListSort, ListSortKey } from './model/views';

export interface ListSortState {
  readonly sort: ListSort;
  /** Ordena pela coluna; pedir a mesma coluna de novo inverte a direção. */
  readonly sortBy: (key: ListSortKey) => void;
}

/** Ordenação da visão em lista; começa pelo código do card, do menor para o maior. */
export function useListSort(): ListSortState {
  const [sort, setSort] = useState<ListSort>({
    key: 'key',
    direction: 'ascending',
  });

  function sortBy(key: ListSortKey) {
    setSort((current) => {
      const sameColumn = current.key === key;
      const wasAscending = current.direction === 'ascending';
      return {
        key,
        direction: sameColumn && wasAscending ? 'descending' : 'ascending',
      };
    });
  }

  return { sort, sortBy };
}

import { allCards, type BoardCard, type BoardLane } from './board';
import type { ListRow } from './views';

/** Recorte da hierarquia na barra do quadro. */
export type HierarchyFilter = 'all' | 'parents' | 'children' | 'top';

export interface HierarchyFilterOption {
  readonly value: HierarchyFilter;
  readonly label: string;
}

/** As opções do filtro de hierarquia, na ordem da barra. */
export const HIERARCHY_FILTERS: readonly HierarchyFilterOption[] = [
  { value: 'all', label: 'Todos os cards' },
  { value: 'parents', label: 'Só cards pai' },
  { value: 'children', label: 'Só cards filhos' },
  { value: 'top', label: 'Só cards de topo' },
];

/** Quem é pai e quem está nas colunas, calculado uma vez para filtrar todos os cards. */
export interface HierarchyIndex {
  /** Ids dos cards das colunas. */
  readonly ids: ReadonlySet<string>;
  /** Ids dos cards que têm ao menos um filho nas colunas. */
  readonly parents: ReadonlySet<string>;
}

export function hierarchyIndex(lanes: readonly BoardLane[]): HierarchyIndex {
  const cards = allCards(lanes);
  const ids = new Set(cards.map((card) => card.id));
  const parents = new Set<string>();
  for (const card of cards) {
    if (card.parentId !== undefined && ids.has(card.parentId)) {
      parents.add(card.parentId);
    }
  }
  return { ids, parents };
}

export interface MatchesHierarchyParams {
  readonly card: BoardCard;
  readonly filter: HierarchyFilter;
  readonly index: HierarchyIndex;
}

/**
 * Diz se o card passa no filtro de hierarquia. Pai é quem tem filho nas colunas; filho é quem tem o pai nas colunas;
 * de topo é quem não tem pai nelas.
 */
export function cardMatchesHierarchy(params: MatchesHierarchyParams): boolean {
  const { card, filter, index } = params;
  const hasParent = card.parentId !== undefined && index.ids.has(card.parentId);
  switch (filter) {
    case 'all':
      return true;
    case 'parents':
      return index.parents.has(card.id);
    case 'children':
      return hasParent;
    case 'top':
      return !hasParent;
  }
}

/** Linha da lista em árvore. */
export interface TreeRow {
  readonly row: ListRow;
  /** Nível na árvore: `0` para quem não tem pai entre as linhas. */
  readonly depth: number;
  /** Tem filho entre as linhas, para a tela oferecer expandir e recolher. */
  readonly hasChildren: boolean;
  /** Os filhos estão recolhidos e não aparecem. */
  readonly collapsed: boolean;
}

export interface TreeRowsParams {
  /** As linhas já filtradas e ordenadas; a árvore mantém essa ordem dentro de cada nível. */
  readonly rows: readonly ListRow[];
  /** Ids dos cards com os filhos recolhidos. */
  readonly collapsed: ReadonlySet<string>;
}

interface TreeWalk {
  readonly children: ReadonlyMap<string, readonly ListRow[]>;
  readonly collapsed: ReadonlySet<string>;
  readonly visited: Set<string>;
  readonly out: TreeRow[];
}

interface VisitParams {
  readonly walk: TreeWalk;
  readonly row: ListRow;
  readonly depth: number;
  /** Um ancestral está recolhido: o card é percorrido, mas não aparece. */
  readonly hidden: boolean;
}

function visit(params: VisitParams): void {
  const { walk, row, depth, hidden } = params;
  const { id } = row.card;
  if (walk.visited.has(id)) {
    return;
  }
  walk.visited.add(id);
  const children = walk.children.get(id) ?? [];
  const collapsed = walk.collapsed.has(id);
  if (!hidden) {
    walk.out.push({ row, depth, hasChildren: children.length > 0, collapsed });
  }
  for (const child of children) {
    visit({ walk, row: child, depth: depth + 1, hidden: hidden || collapsed });
  }
}

/**
 * Lista em árvore: cada linha seguida dos filhos, com recuo por nível e sem os filhos dos cards recolhidos. Quem tem o
 * pai fora das linhas (filtrado ou fora das colunas) fica no nível de topo.
 */
export function treeRows(params: TreeRowsParams): readonly TreeRow[] {
  const { rows, collapsed } = params;
  const present = new Set(rows.map((row) => row.card.id));
  const children = new Map<string, ListRow[]>();
  const roots: ListRow[] = [];
  for (const row of rows) {
    const { parentId } = row.card;
    if (parentId === undefined || !present.has(parentId)) {
      roots.push(row);
      continue;
    }
    const siblings = children.get(parentId) ?? [];
    siblings.push(row);
    children.set(parentId, siblings);
  }
  const walk: TreeWalk = { children, collapsed, visited: new Set(), out: [] };
  for (const root of roots) {
    visit({ walk, row: root, depth: 0, hidden: false });
  }
  // NOTE: num ciclo de pais gravado à mão nenhum card é raiz; eles entram no topo em vez de sumir da lista.
  for (const row of rows) {
    visit({ walk, row, depth: 0, hidden: false });
  }
  return walk.out;
}

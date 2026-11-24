import type { BoardCard, BoardLane } from './board';
import { normalizeText } from './search';

/** Os cards de uma coluna que pertencem a uma linha. */
export interface GroupCell {
  readonly lane: BoardLane;
  readonly cards: readonly BoardCard[];
}

/** Linha de cards de um card pai: os filhos dele, coluna a coluna. Sem `parent`, é a linha dos cards sem pai. */
export interface ParentGroup {
  readonly parent?: BoardCard;
  readonly cells: readonly GroupCell[];
}

/** Ids dos cards que têm pelo menos um filho nas colunas dadas. */
function parentIdsIn(lanes: readonly BoardLane[]): ReadonlySet<string> {
  const parentIds = new Set<string>();
  for (const lane of lanes) {
    for (const card of lane.cards) {
      if (card.parentId !== undefined) {
        parentIds.add(card.parentId);
      }
    }
  }
  return parentIds;
}

interface CellsOfParams {
  readonly lanes: readonly BoardLane[];
  /** Card pai da linha; `undefined` na linha dos cards sem pai. */
  readonly parentId: string | undefined;
}

/** Em cada coluna, os cards que são filhos de `parentId`. */
function cellsOf(params: CellsOfParams): readonly GroupCell[] {
  return params.lanes.map((lane) => ({
    lane,
    cards: lane.cards.filter((card) => card.parentId === params.parentId),
  }));
}

export interface GroupByParentParams {
  /** As colunas que estão na tela. */
  readonly lanes: readonly BoardLane[];
  /** Todas as colunas do quadro; o pai de uma linha pode estar numa coluna oculta. */
  readonly allLanes: readonly BoardLane[];
}

/**
 * Agrupa os cards das colunas pelo card pai, como as raias do Jira: uma linha por pai que tem filhos nas colunas, na
 * ordem em que os pais aparecem no quadro, e no fim a linha dos cards sem pai.
 */
export function groupByParent(
  params: GroupByParentParams,
): readonly ParentGroup[] {
  const { lanes, allLanes } = params;
  const parentIds = parentIdsIn(lanes);
  const groups: ParentGroup[] = [];

  for (const lane of allLanes) {
    for (const card of lane.cards) {
      if (parentIds.has(card.id)) {
        groups.push({
          parent: card,
          cells: cellsOf({ lanes, parentId: card.id }),
        });
      }
    }
  }

  const orphanCells = cellsOf({ lanes, parentId: undefined });
  const hasOrphans = orphanCells.some((cell) => cell.cards.length > 0);
  if (hasOrphans) {
    groups.push({ cells: orphanCells });
  }
  return groups;
}

/** Colunas da lista que podem ordenar as linhas. */
export type ListSortKey = 'key' | 'title' | 'lane' | 'assignee' | 'due';

export interface ListSort {
  readonly key: ListSortKey;
  readonly direction: 'ascending' | 'descending';
}

/** Linha da visão em lista: o card, a coluna onde está e a posição no quadro, que desempata a ordem. */
export interface ListRow {
  readonly card: BoardCard;
  readonly lane: BoardLane;
  readonly laneIndex: number;
  readonly position: number;
  /** Nome do responsável. */
  readonly assignee?: string;
}

export interface ListRowsParams {
  readonly lanes: readonly BoardLane[];
  /** Nome de cada pessoa do quadro, pelo id. */
  readonly people: ReadonlyMap<string, string>;
}

/** Uma linha por card, na ordem em que os cards aparecem no quadro. */
export function listRows(params: ListRowsParams): readonly ListRow[] {
  const rows: ListRow[] = [];
  params.lanes.forEach((lane, laneIndex) => {
    for (const card of lane.cards) {
      const assignee = card.assigneeId
        ? params.people.get(card.assigneeId)
        : undefined;
      rows.push({ card, lane, laneIndex, position: rows.length + 1, assignee });
    }
  });
  return rows;
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/** Dois textos a comparar, cada um podendo faltar, e o sentido da ordem. */
interface OptionalComparison {
  readonly a: string | undefined;
  readonly b: string | undefined;
  readonly direction: 1 | -1;
}

/** Compara dois textos; o que falta vai sempre para o fim, nas duas direções. */
function compareOptional(params: OptionalComparison): number {
  const { a, b, direction } = params;
  if (a === undefined && b === undefined) {
    return 0;
  }
  if (a === undefined) {
    return 1;
  }
  if (b === undefined) {
    return -1;
  }
  return collator.compare(normalizeText(a), normalizeText(b)) * direction;
}

interface RowComparison {
  readonly a: ListRow;
  readonly b: ListRow;
  readonly sort: ListSort;
}

/** Compara duas linhas só pela coluna escolhida; `0` quando empatam nela. */
function compareByColumn(params: RowComparison): number {
  const { a, b, sort } = params;
  const direction = sort.direction === 'ascending' ? 1 : -1;
  switch (sort.key) {
    case 'key':
      return ((a.card.number ?? 0) - (b.card.number ?? 0)) * direction;
    case 'title':
      return compareOptional({ a: a.card.title, b: b.card.title, direction });
    case 'lane':
      return (a.laneIndex - b.laneIndex) * direction;
    case 'assignee':
      return compareOptional({ a: a.assignee, b: b.assignee, direction });
    case 'due':
      return compareOptional({
        a: a.card.dueDate,
        b: b.card.dueDate,
        direction,
      });
  }
}

export interface SortRowsParams {
  readonly rows: readonly ListRow[];
  readonly sort: ListSort;
}

/** Ordena as linhas pela coluna escolhida; empate fica na ordem do quadro. */
export function sortRows(params: SortRowsParams): readonly ListRow[] {
  const sorted = [...params.rows];
  sorted.sort((a, b) => {
    const byColumn = compareByColumn({ a, b, sort: params.sort });
    if (byColumn !== 0) {
      return byColumn;
    }
    return a.position - b.position;
  });
  return sorted;
}

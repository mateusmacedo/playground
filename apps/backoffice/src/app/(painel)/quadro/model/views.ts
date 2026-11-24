import type { BoardCard, BoardLane } from './board';
import { normalizeText } from './search';

/** Linha de cards de um card pai: os filhos dele, coluna a coluna. Sem `parent`, é a linha dos cards sem pai. */
export interface ParentGroup {
  readonly parent?: BoardCard;
  readonly cells: readonly {
    readonly lane: BoardLane;
    readonly cards: readonly BoardCard[];
  }[];
}

export interface GroupByParentParams {
  readonly lanes: readonly BoardLane[];
  readonly allLanes: readonly BoardLane[];
}

/**
 * Agrupa os cards das colunas pelo card pai, como as raias do Jira: uma linha por pai que tem filhos nas colunas, na
 * ordem em que os pais aparecem no quadro, e no fim a linha dos cards sem pai. `allLanes` acha o pai mesmo numa coluna
 * oculta.
 */
export function groupByParent(
  params: GroupByParentParams,
): readonly ParentGroup[] {
  const { lanes, allLanes } = params;
  const cards = new Map(
    allLanes.flatMap((lane) => lane.cards).map((card) => [card.id, card]),
  );
  const parentOrder = [
    ...new Set(
      allLanes
        .flatMap((lane) => lane.cards)
        .filter((card) =>
          lanes.some((lane) =>
            lane.cards.some((child) => child.parentId === card.id),
          ),
        )
        .map((card) => card.id),
    ),
  ];
  const rowOf = (parentId: string | undefined) => ({
    parent: parentId ? cards.get(parentId) : undefined,
    cells: lanes.map((lane) => ({
      lane,
      cards: lane.cards.filter((card) => card.parentId === parentId),
    })),
  });
  const orphans = rowOf(undefined);
  const groups: ParentGroup[] = parentOrder.map(rowOf);
  return orphans.cells.some((cell) => cell.cards.length > 0)
    ? [...groups, orphans]
    : groups;
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
  readonly assignee?: string;
}

export interface ListRowsParams {
  readonly lanes: readonly BoardLane[];
  readonly people: ReadonlyMap<string, string>;
}

export function listRows(params: ListRowsParams): readonly ListRow[] {
  let position = 0;
  return params.lanes.flatMap((lane, laneIndex) =>
    lane.cards.map((card) => {
      position += 1;
      return {
        card,
        lane,
        laneIndex,
        position,
        assignee: card.assigneeId
          ? params.people.get(card.assigneeId)
          : undefined,
      };
    }),
  );
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/** Dois textos a comparar, cada um podendo faltar, e o sentido da ordem. */
interface OptionalComparison {
  readonly a: string | undefined;
  readonly b: string | undefined;
  readonly direction: 1 | -1;
}

/** Valor vazio vai sempre para o fim, nas duas direções. */
function compareOptional(params: OptionalComparison): number {
  const { a, b, direction } = params;
  if (a === undefined || b === undefined) {
    return a === b ? 0 : a === undefined ? 1 : -1;
  }
  return collator.compare(normalizeText(a), normalizeText(b)) * direction;
}

export interface SortRowsParams {
  readonly rows: readonly ListRow[];
  readonly sort: ListSort;
}

/** Ordena as linhas pela coluna escolhida; empate fica na ordem do quadro. */
export function sortRows(params: SortRowsParams): readonly ListRow[] {
  const { key } = params.sort;
  const direction = params.sort.direction === 'ascending' ? 1 : -1;
  const compare = (a: ListRow, b: ListRow): number => {
    switch (key) {
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
  };
  return [...params.rows].sort(
    (a, b) => compare(a, b) || a.position - b.position,
  );
}

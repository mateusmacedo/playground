import { BoardListTitle } from './board-list-title';
import type { ListTree } from './list-tree';
import type { BoardLabel } from './model/board';
import { cardKey } from './model/card-key';
import { type ChildProgress, progressText } from './model/completion';
import { type DueStatus, dueStatus, formatShortDate } from './model/due';
import { cardLabels } from './model/labels';
import type { ListRow, ListSort, ListSortKey } from './model/views';
import { ProcessBadge } from './process-badge';

const COLUMNS: readonly {
  readonly key: ListSortKey;
  readonly label: string;
}[] = [
  { key: 'key', label: 'Código' },
  { key: 'title', label: 'Título' },
  { key: 'lane', label: 'Coluna' },
  { key: 'assignee', label: 'Responsável' },
  { key: 'due', label: 'Prazo' },
];

const DUE_CLASS: Readonly<Record<DueStatus, string>> = {
  overdue: 'text-danger fw-semibold',
  today: 'text-warning-emphasis fw-semibold',
  done: 'text-success',
  upcoming: '',
};

export interface BoardListProps {
  readonly rows: readonly ListRow[];
  readonly keyPrefix: string;
  readonly labels: readonly BoardLabel[];
  readonly today: string | undefined;
  readonly progress: ReadonlyMap<string, ChildProgress>;
  /** Cards com bloqueador fora da coluna de conclusão. */
  readonly blocked: ReadonlySet<string>;
  /** A lista em árvore, com o nível e os filhos de cada linha; sem ela, a lista é plana. */
  readonly tree?: ListTree;
  readonly sort: ListSort;
  readonly onSort: (key: ListSortKey) => void;
  readonly onOpen: (cardId: string) => void;
}

/**
 * Visão em lista: um card por linha, com código, título, coluna, responsável, prazo, progresso dos descendentes,
 * processo e etiquetas. O cabeçalho ordena as linhas; o título abre o card no painel.
 */
export function BoardList({
  rows,
  keyPrefix,
  labels,
  today,
  progress,
  blocked,
  tree,
  sort,
  onSort,
  onOpen,
}: Readonly<BoardListProps>) {
  return (
    <div className="table-responsive kanban-list">
      <table className="table table-sm table-hover align-middle mb-0">
        <caption className="visually-hidden">
          Cards do quadro, um por linha
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = sort.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? sort.direction : undefined}
                >
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 fw-semibold text-body text-decoration-none"
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                    {active ? (
                      <span aria-hidden="true">
                        {sort.direction === 'ascending' ? ' ▲' : ' ▼'}
                      </span>
                    ) : null}
                  </button>
                </th>
              );
            })}
            <th scope="col">Filhos</th>
            <th scope="col">Processo</th>
            <th scope="col">Etiquetas</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length + 3} className="text-body-secondary">
                Nenhum card para mostrar.
              </td>
            </tr>
          ) : (
            rows.map(({ card, lane, assignee }) => {
              const status = today ? dueStatus({ card, today }) : undefined;
              const childProgress = progress.get(card.id);
              return (
                <tr key={card.id}>
                  <td className="text-nowrap text-body-secondary">
                    {cardKey({ card, prefix: keyPrefix })}
                  </td>
                  <td>
                    <BoardListTitle
                      card={card}
                      blocked={blocked.has(card.id)}
                      tree={tree}
                      onOpen={onOpen}
                    />
                  </td>
                  <td>{lane.title}</td>
                  <td>{assignee ?? '—'}</td>
                  <td className={status ? DUE_CLASS[status] : undefined}>
                    {card.dueDate ? formatShortDate(card.dueDate) : '—'}
                  </td>
                  <td>{childProgress ? progressText(childProgress) : '—'}</td>
                  <td>{card.process ? <ProcessBadge card={card} /> : '—'}</td>
                  <td>
                    {cardLabels({ card, labels }).map((label) => (
                      <span
                        key={label.id}
                        className={`badge text-bg-${label.color} me-1`}
                      >
                        {label.name}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

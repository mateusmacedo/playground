import type { Crumb } from './model/subprocess';

export interface SubprocessBreadcrumbProps {
  readonly crumbs: readonly Crumb[];
  readonly onOpenLevel: (depth: number) => void;
}

/** Trilha dentro do editor: o processo principal e os subprocessos abertos; só aparece dentro de um subprocesso. */
export function SubprocessBreadcrumb({
  crumbs,
  onOpenLevel,
}: Readonly<SubprocessBreadcrumbProps>) {
  if (crumbs.length === 0) {
    return null;
  }
  return (
    <nav aria-label="Níveis do processo" className="process-levels">
      <ol className="breadcrumb small mb-2">
        <li className="breadcrumb-item">
          <button
            type="button"
            className="btn btn-link btn-sm p-0"
            onClick={() => onOpenLevel(0)}
          >
            Processo principal
          </button>
        </li>
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;
          return (
            <li
              key={crumb.nodeId}
              className={`breadcrumb-item${isCurrent ? ' active' : ''}`}
              aria-current={isCurrent ? 'page' : undefined}
            >
              {isCurrent ? (
                crumb.name
              ) : (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0"
                  onClick={() => onOpenLevel(index + 1)}
                >
                  {crumb.name}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

import { cilInfo, cilWarning } from '@coreui/icons';
import CIcon from '@coreui/icons-react';

import type { ProcessIssue } from '../model/issues';

export interface IssueListProps {
  readonly issues: readonly ProcessIssue[];
  readonly emptyText?: string;
  /** Com ele, cada problema vira um botão que seleciona e enquadra o elemento. */
  readonly onSelect?: (issue: ProcessIssue) => void;
}

const SEVERITY_TEXT = { error: 'Erro', warning: 'Aviso' } as const;

interface IssueTextProps {
  readonly issue: ProcessIssue;
}

function IssueText({ issue }: Readonly<IssueTextProps>) {
  return (
    <>
      <CIcon
        icon={issue.severity === 'error' ? cilWarning : cilInfo}
        aria-hidden="true"
        className="me-1"
      />
      <span className="visually-hidden">{`${SEVERITY_TEXT[issue.severity]}: `}</span>
      {issue.message}
    </>
  );
}

/** Lista de problemas, erros antes de avisos; sem problema, mostra `emptyText` quando ele vem, ou nada. */
export function IssueList({
  issues,
  emptyText,
  onSelect,
}: Readonly<IssueListProps>) {
  if (issues.length === 0) {
    return emptyText ? (
      <p className="small text-body-secondary">{emptyText}</p>
    ) : null;
  }
  const ordered = [
    ...issues.filter((issue) => issue.severity === 'error'),
    ...issues.filter((issue) => issue.severity === 'warning'),
  ];
  return (
    <ul className="process-issue-list small">
      {ordered.map((issue) => {
        const target = issue.nodeId ?? issue.edgeId;
        const className = `process-issue process-issue--${issue.severity}`;
        return (
          <li key={issue.key} className={className}>
            {onSelect && target !== undefined ? (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-start process-issue__button"
                onClick={() => onSelect(issue)}
              >
                <IssueText issue={issue} />
              </button>
            ) : (
              <IssueText issue={issue} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
